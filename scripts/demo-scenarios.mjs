const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

const scenarios = [
  {
    title: "Coupon + quantity edit makes total NaN",
    url: `${baseUrl}/checkout`,
    steps: [
      "Open the checkout page.",
      "Enter SAVE10 in the coupon field.",
      "Click Apply.",
      "Change any item quantity from 1 to 2.",
      "Open Feedback and submit the report below.",
      "Open the dashboard link from the success message.",
    ],
    report: {
      whatHappened: "After applying SAVE10 and changing quantity, the checkout total became NaN.",
      expected: "The total should recalculate correctly with the discount.",
      steps: "Go to checkout, apply SAVE10, then change an item quantity from 1 to 2.",
    },
  },
  {
    title: "Reapplying coupon after removing an item disables checkout",
    url: `${baseUrl}/checkout`,
    steps: [
      "Open the checkout page.",
      "Enter SAVE10 in the coupon field.",
      "Click Apply.",
      "Remove one item from the checkout.",
      "Click Apply again.",
      "Open Feedback and submit the report below.",
      "Open the dashboard link from the success message.",
    ],
    report: {
      whatHappened: "Reapplying SAVE10 after removing an item crashed the coupon flow and disabled Place order.",
      expected: "The coupon should apply correctly or show a validation message without disabling checkout.",
      steps: "Go to checkout, apply SAVE10, remove an item, then click Apply again.",
    },
  },
  {
    title: "Double-clicking Place order creates duplicate orders",
    url: `${baseUrl}/checkout?fast=1`,
    steps: [
      "Open the checkout page in fast demo mode.",
      "Double-click Place order quickly.",
      "Confirm multiple order IDs appear in Created orders.",
      "Open Feedback and submit the report below.",
      "Open the dashboard link from the success message.",
    ],
    report: {
      whatHappened: "Double-clicking Place order created duplicate orders.",
      expected: "Only one order should be created and the button should lock while submitting.",
      steps: "Open /checkout?fast=1 and double-click Place order quickly.",
    },
  },
];

console.log(`QuickCart M0 demo script\nBase URL: ${baseUrl}\n`);
console.log("Before starting, run `npm run dev` in another terminal.\n");

for (const [index, scenario] of scenarios.entries()) {
  console.log(`${index + 1}. ${scenario.title}`);
  console.log(`   URL: ${scenario.url}`);
  console.log("   Steps:");

  for (const step of scenario.steps) {
    console.log(`   - ${step}`);
  }

  console.log("   Feedback text:");
  console.log(`   - What happened: ${scenario.report.whatHappened}`);
  console.log(`   - Expected: ${scenario.report.expected}`);
  console.log(`   - Steps: ${scenario.report.steps}`);
  console.log("");
}

console.log("After each submission, the Feedback modal links directly to that dashboard issue.");
