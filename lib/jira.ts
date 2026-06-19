import { readFile } from "node:fs/promises";
import path from "node:path";

export function logJiraDebug(event: string, details: Record<string, unknown> = {}) {
  console.info(`[jira] ${event}`, details);
}

type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
};

export function getJiraConfig(): JiraConfig | null {
  const baseUrl = process.env.JIRA_URL?.replace(/\/+$/, "");
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!baseUrl || !email || !apiToken || !projectKey) {
    return null;
  }

  return { baseUrl, email, apiToken, projectKey };
}

export type JiraBugInput = {
  reportId: string;
  summary: string;
  severity: string | null;
  affectedArea: string | null;
  pageUrl: string;
  whatHappened: string;
  expected: string;
  observedVsExpected: string;
  narrative: string;
  reproSteps: string[];
  consoleOutput: string[];
  screenshotPaths: string[];
};

export type JiraBugResult = {
  id: string;
  key: string;
  url: string;
};

function authHeader(config: JiraConfig) {
  const token = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  return `Basic ${token}`;
}

type AdfNode = Record<string, unknown>;

function text(value: string): AdfNode {
  // ADF rejects empty text nodes.
  return { type: "text", text: value.length > 0 ? value : " " };
}

function paragraph(value: string): AdfNode {
  return { type: "paragraph", content: [text(value)] };
}

function heading(value: string): AdfNode {
  return { type: "heading", attrs: { level: 3 }, content: [text(value)] };
}

function bulletList(items: string[]): AdfNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function buildDescription(input: JiraBugInput): AdfNode {
  const content: AdfNode[] = [];

  content.push(heading("Summary"));
  content.push(paragraph(input.summary));

  content.push(heading("Details"));
  content.push(
    bulletList([
      `Severity: ${input.severity ?? "unknown"}`,
      `Affected area: ${input.affectedArea ?? "unknown"}`,
      `Page: ${input.pageUrl}`,
      `Report ID: ${input.reportId}`,
    ]),
  );

  content.push(heading("What the user reported"));
  content.push(paragraph(`What happened: ${input.whatHappened}`));
  content.push(paragraph(`Expected: ${input.expected}`));

  content.push(heading("Automated reproduction"));
  content.push(paragraph(input.narrative));
  content.push(paragraph(`Observed vs expected: ${input.observedVsExpected}`));

  if (input.reproSteps.length > 0) {
    content.push(heading("Steps to reproduce"));
    content.push(bulletList(input.reproSteps));
  }

  if (input.consoleOutput.length > 0) {
    content.push(heading("Console output"));
    content.push({
      type: "codeBlock",
      content: [text(input.consoleOutput.join("\n").slice(0, 4000))],
    });
  }

  content.push(paragraph("Filed automatically by the QuickCart reproduction agent."));

  return { version: 1, type: "doc", content };
}

async function attachScreenshots(
  config: JiraConfig,
  issueKey: string,
  screenshotPaths: string[],
) {
  for (const screenshotPath of screenshotPaths) {
    try {
      const data = await readFile(screenshotPath);
      const form = new FormData();
      const fileBytes = new Uint8Array(data);
      form.append("file", new Blob([fileBytes], { type: "image/png" }), path.basename(screenshotPath));

      const response = await fetch(`${config.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
        method: "POST",
        headers: {
          Authorization: authHeader(config),
          "X-Atlassian-Token": "no-check",
          Accept: "application/json",
        },
        body: form,
      });

      if (!response.ok) {
        const body = await response.text();
        logJiraDebug("attachment upload failed", {
          issueKey,
          screenshot: path.basename(screenshotPath),
          status: response.status,
          body: body.slice(0, 300),
        });
      } else {
        logJiraDebug("attachment uploaded", {
          issueKey,
          screenshot: path.basename(screenshotPath),
        });
      }
    } catch (error) {
      logJiraDebug("attachment error", {
        issueKey,
        screenshot: path.basename(screenshotPath),
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

export async function createJiraBug(input: JiraBugInput): Promise<JiraBugResult> {
  const config = getJiraConfig();

  if (!config) {
    throw new Error("Jira is not configured (missing JIRA_URL/JIRA_EMAIL/JIRA_API_TOKEN/JIRA_PROJECT_KEY).");
  }

  const payload = {
    fields: {
      project: { key: config.projectKey },
      summary: input.summary.slice(0, 250),
      description: buildDescription(input),
      issuetype: { name: "Bug" },
    },
  };

  logJiraDebug("creating issue", {
    reportId: input.reportId,
    projectKey: config.projectKey,
    summaryLength: input.summary.length,
  });

  const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    logJiraDebug("create issue failed", {
      reportId: input.reportId,
      status: response.status,
      body: body.slice(0, 500),
    });
    throw new Error(`Jira issue creation failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const created = (await response.json()) as { id: string; key: string };
  const url = `${config.baseUrl}/browse/${created.key}`;
  logJiraDebug("created issue", {
    reportId: input.reportId,
    id: created.id,
    key: created.key,
    url,
  });

  if (input.screenshotPaths.length > 0) {
    await attachScreenshots(config, created.key, input.screenshotPaths);
  }

  return { id: created.id, key: created.key, url };
}
