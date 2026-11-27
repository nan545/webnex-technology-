import assert from "node:assert/strict";
import test from "node:test";
import { products } from "../src/data/products";
import { serviceContent, serviceDivisions } from "../src/data/service-content";

test("corporate catalogue contains five divisions and the approved product portfolio", () => {
  assert.equal(serviceDivisions.length, 5);
  assert.equal(serviceContent.length >= 25, true);
  for (const division of serviceDivisions) {
    assert.equal(serviceContent.some((service) => service.division === division.title), true);
  }
  assert.deepEqual(products.map((product) => product.name), ["StockFlow", "STAYFLEX"]);
});

test("catalogue has no fixed prices", () => {
  assert.equal(JSON.stringify(serviceContent).includes("₵"), false);
  assert.equal(JSON.stringify(serviceContent).includes("$"), false);
});
