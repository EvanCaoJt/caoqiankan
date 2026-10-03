import assert from "node:assert/strict";
import { test } from "node:test";
import { correctUsdScale } from "@aihot/backend/editorial/money";
import { finalizeCopy } from "@aihot/backend/editorial/writing";

test("USD billion/million/trillion scale errors are corrected without changing other figures", () => {
  assert.equal(correctUsdScale("$150 billion increase, $235 billion remaining", "增加 150 亿美元，剩余 2350 亿美元，2028 年执行。"), "增加 1500 亿美元，剩余 2350 亿美元，2028 年执行。");
  assert.equal(correctUsdScale("USD 1.25 million", "金额为1.25万美元"), "金额为125 万美元");
  assert.equal(correctUsdScale("US$2 trillion", "2亿美元"), "2 万亿美元");
});
test("correct values, ambiguous amounts/currencies, altered coefficients and non-money numbers stay untouched", () => {
  for (const [source, copy] of [
    ["$150 billion", "1500 亿美元"], ["$150 billion and $150 million", "150 亿美元"],
    ["$150 billion and $15 billion", "150 亿美元"], ["150 billion parameters", "150 亿参数"],
    ["HKD $150 billion", "150 亿美元"], ["$150 billion", "20 亿美元"],
  ]) assert.equal(correctUsdScale(source!, copy!), copy);
});
test("both reader title and summary pass the scale guard", () => {
  const copy = finalizeCopy({ title: "NVIDIA authorizes $150 billion", text: "$235 billion remains.", sourceKind: "rss" }, { titleZh: "NVIDIA 增加150亿美元", summaryZh: "追加150亿美元，剩余2350亿美元。" });
  assert.equal(copy.titleZh, "NVIDIA 增加1500 亿美元");
  assert.equal(copy.summaryZh, "追加1500 亿美元，剩余2350亿美元。");
});
