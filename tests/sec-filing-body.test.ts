import assert from "node:assert/strict";
import { test } from "node:test";
import { extractSecFiling, isSecFilingIndex, secDocuments } from "@aihot/backend/content/sec-edgar";
import { renderContext } from "@aihot/backend/editorial/writing";

const base = "https://www.sec.gov/Archives/edgar/data/1318605/000162828026064366/";
const index = base + "0001628280-26-064366-index.htm";
const row = (type: string, link: string) => `<tr><td>1</td><td>Document</td><td><a href="${link}">Document</a></td><td>${type}</td><td>1000</td></tr>`;
const listing = `<table summary="Document Format Files">${row("8-K", "/ix?doc=" + new URL(base).pathname + "main.htm")}${row("EX-99.1", "earnings.htm")}${row("EX-99.2", "https://evil.example/earnings.htm")}${row("EX-101.SCH", "facts.xsd")}${row("EX-99.3", "../other.htm")}</table>`;
const text = "Quarterly revenue was $150 billion, up 20 percent. ".repeat(8);
const response = (url: string, body: string, status=200) => ({url,status,headers:new Headers({"content-type":"text/html"}),body:Buffer.from(body),text:()=>body});

test("filing directory detection and document selection cannot follow external or other-accession links", () => {
  assert.equal(isSecFilingIndex(index), true);
  assert.equal(isSecFilingIndex(index.replace("sec.gov", "sec.gov.evil.example")), false);
  assert.deepEqual(secDocuments(listing,index), [{type:"8-K",url:base+"main.htm"},{type:"EX-99.1",url:base+"earnings.htm"}]);
  assert.deepEqual(secDocuments(row("8-K","main.htm"),index),[]);
});
test("extracts actual 8-K and earnings exhibit, retaining financial tables and omitting hidden XBRL", async () => {
  const calls: string[]=[];
  const body=await extractSecFiling(index,async url=>{calls.push(url);return response(url,url===index?listing:`<html><body><p>${text}</p><table><tr><td>Revenue</td><td>150000</td></tr></table><ix:hidden>HIDDENFACT</ix:hidden></body></html>`);});
  assert.deepEqual(calls,[index,base+"main.htm",base+"earnings.htm"]);
  assert.equal(body?.via,"sec_edgar");
  assert.match(body!.text,/Quarterly revenue/);
  assert.match(body!.text,/150000/);
  assert.doesNotMatch(body!.text,/HIDDENFACT/);
});
test("missing or blocked exhibit never becomes a confirmed directory body", async () => {
  assert.equal(await extractSecFiling(index,async url=>response(url,url===index?listing:`<p>${text}</p>`,url.endsWith("earnings.htm")?403:200)),null);
  assert.equal(await extractSecFiling(index,async url=>response(url,"<p>Directory metadata with no documents</p>")),null);
});
test("unfetched SEC material is not described to the model as a complete disclosure", () => {
  const context=renderContext({url:index,title:"SEC 8-K",excerpt:"Item 2.02",bodyText:null,bodyStatus:"unconfirmed",source:{name:"SEC",kind:"rss",tier:"T1"},xPost:null,media:[]} as never);
  assert.match(context,/不能据此断言公告未披露数据/);
});
