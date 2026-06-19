import { spawn } from "node:child_process";

const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const mode = process.argv.includes("--submit")
  ? "submit"
  : process.argv.includes("--open")
    ? "open"
    : "print";

const scenarios = [
  {
    kind: "bug",
    title: "Coupon + quantity edit makes total NaN",
    url: `${baseUrl}/checkout`,
    report: {
      whatHappened: "After applying SAVE10 and changing quantity, the checkout total became NaN.",
      expected: "The total should recalculate correctly with the discount.",
      steps: "Go to checkout, apply SAVE10, then change an item quantity from 1 to 2.",
    },
  },
  {
    kind: "bug",
    title: "Reapplying coupon after removing an item disables checkout",
    url: `${baseUrl}/checkout`,
    report: {
      whatHappened:
        "Reapplying SAVE10 after removing an item crashed the coupon flow and disabled Place order.",
      expected: "The coupon should apply correctly or show a validation message without disabling checkout.",
      steps: "Go to checkout, apply SAVE10, remove an item, then click Apply again.",
    },
  },
  {
    kind: "bug",
    title: "Double-clicking Place order creates duplicate orders",
    url: `${baseUrl}/checkout?fast=1`,
    report: {
      whatHappened: "Double-clicking Place order created duplicate orders.",
      expected: "Only one order should be created and the button should lock while submitting.",
      steps: "Open /checkout?fast=1 and double-click Place order quickly.",
    },
  },
  {
    kind: "feature_request",
    title: "Saved carts",
    url: `${baseUrl}/cart`,
    report: {
      whatHappened: "I want to save my cart and come back to it later.",
      expected: "QuickCart should let me save named carts across browser sessions.",
      steps: "Open the cart and look for a save cart option.",
    },
  },
  {
    kind: "feature_request",
    title: "Product comparison",
    url: `${baseUrl}/`,
    report: {
      whatHappened: "I want to compare products side-by-side before adding them to my cart.",
      expected: "QuickCart should include a product comparison feature on the storefront.",
      steps: "Open the storefront and look for compare controls on products.",
    },
  },
];

function openUrl(url) {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(command, [url], { shell: process.platform === "win32", stdio: "ignore" });
  child.unref();
}

async function submitScenario(scenario) {
  const response = await fetch(`${baseUrl}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...scenario.report,
      pageUrl: new URL(scenario.url).pathname + new URL(scenario.url).search,
      userAgent: "QuickCart demo seed script",
      consoleErrors: [],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${scenario.title}: ${response.status} ${body}`);
  }

  const report = await response.json();
  return report;
}

console.log(`QuickCart M3 demo seed\nBase URL: ${baseUrl}\nMode: ${mode}\n`);

if (mode === "open") {
  for (const scenario of scenarios) {
    console.log(`Opening ${scenario.title}: ${scenario.url}`);
    openUrl(scenario.url);
  }
} else if (mode === "submit") {
  for (const scenario of scenarios) {
    const report = await submitScenario(scenario);
    console.log(`${scenario.title}: ${report.id} (${report.status})`);
  }
  console.log(`\nDashboard: ${baseUrl}/dashboard`);
} else {
  for (const [index, scenario] of scenarios.entries()) {
    console.log(`${index + 1}. [${scenario.kind}] ${scenario.title}`);
    console.log(`   URL: ${scenario.url}`);
    console.log(`   What happened: ${scenario.report.whatHappened}`);
    console.log(`   Expected: ${scenario.report.expected}`);
    console.log(`   Steps: ${scenario.report.steps}`);
    console.log("");
  }
  console.log("Use `npm run demo:seed -- --open` to open all scenario pages.");
  console.log("Use `npm run demo:seed -- --submit` to submit all five reports via the API.");
}
