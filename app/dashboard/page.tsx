import Link from "next/link";
import { DashboardAutoRefresh } from "@/components/DashboardAutoRefresh";
import { prisma } from "@/lib/db";
import { LANES, laneCardMeta, laneForReport } from "@/lib/reportView";

export const dynamic = "force-dynamic";

type ReportRow = Awaited<ReturnType<typeof prisma.report.findMany>>[number];

export default async function DashboardPage() {
  const reports = await prisma.report.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  const hasRunningReproduction = reports.some((report) => report.reproStatus === "running");

  const grouped = new Map<string, ReportRow[]>(LANES.map((lane) => [lane.id, []]));
  for (const report of reports) {
    const laneId = laneForReport(report);
    grouped.get(laneId)?.push(report);
  }

  const metrics = [
    { value: reports.length, label: "Signals captured" },
    {
      value: reports.filter((report) => report.classification === "bug").length,
      label: "Bugs triaged",
    },
    {
      value: reports.filter((report) => report.reproStatus === "reproduced").length,
      label: "Reproduced",
    },
    {
      value: reports.filter((report) => report.ticketStatus === "filed").length,
      label: "Tickets filed",
    },
    {
      value: reports.filter((report) => report.classification === "feature_request").length,
      label: "Feature requests",
    },
  ];

  return (
    <div className="space-y-8">
      <DashboardAutoRefresh enabled={hasRunningReproduction} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label text-[11px] text-[#b5792a]">Reproduction console</p>
          <h1 className="mt-2 text-3xl font-bold text-[#16191f]">Issue routing board</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6a7180]">
            Every feedback signal is triaged, categorized, and — for bugs — reproduced in a real
            browser before a ticket is filed.
          </p>
        </div>
        {hasRunningReproduction ? (
          <span className="mono-label inline-flex items-center gap-2 rounded-full border border-[#e3e4e9] bg-white px-3 py-1.5 text-[10px] text-[#5b7cfa]">
            <span className="led" style={{ background: "#5b7cfa" }} />
            Live · reproduction running
          </span>
        ) : null}
      </div>

      {reports.length === 0 ? (
        <section className="rounded-xl border border-dashed border-[#d4d6dc] bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-[#16191f]">No signals yet</h2>
          <p className="mt-2 text-[#6a7180]">
            Trigger a checkout bug, click &quot;Feedback&quot;, and submit the modal.
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <div
                className="rounded-xl border border-[#e3e4e9] bg-white px-4 py-4"
                key={metric.label}
              >
                <div className="text-3xl font-semibold leading-none text-[#16191f]">
                  {metric.value}
                </div>
                <div className="mono-label mt-2 text-[10px] text-[#6a7180]">{metric.label}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {LANES.map((lane) => {
              const laneReports = grouped.get(lane.id) ?? [];

              return (
                <div
                  className="min-h-40 rounded-xl border border-[#e3e4e9] bg-white p-3"
                  key={lane.id}
                >
                  <div className="flex items-center gap-2">
                    <span className="led" style={{ background: lane.color }} />
                    <span className="mono-label text-[10.5px] font-semibold text-[#16191f]">
                      {lane.name}
                    </span>
                    <span className="mono-label ml-auto text-[11px] text-[#9aa0ad]">
                      {laneReports.length}
                    </span>
                  </div>
                  <p className="mono-label mt-1 text-[9px] text-[#9aa0ad]">{lane.blurb}</p>

                  <div className="mt-3 space-y-2">
                    {laneReports.length === 0 ? (
                      <p className="py-2 text-center text-[11px] text-[#9aa0ad]">Nothing here yet</p>
                    ) : (
                      laneReports.map((report) => (
                        <Link
                          className="block rounded-lg border border-[#e3e4e9] bg-white p-2.5 transition hover:border-[#cdd0d7] hover:shadow-sm"
                          href={`/dashboard/${report.id}`}
                          key={report.id}
                          style={{ borderLeftColor: lane.color, borderLeftWidth: 3 }}
                        >
                          <p className="line-clamp-2 text-[12.5px] leading-snug text-[#16191f]">
                            {report.whatHappened}
                          </p>
                          <p className="mono-label mt-1.5 text-[9.5px] text-[#9aa0ad]">
                            {laneCardMeta(report)}
                          </p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
