import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test(
  "database reports preserve opening, cumulative and paged ledger balances",
  { skip: process.env.ACCOUNTING_DB_TEST !== "local-only" },
  () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require=createRequire(import.meta.url);
    const { withAccountingTestDatabase } = await import('./src/modules/accounting/server/test-database.ts');
    await withAccountingTestDatabase(async tx => {
      const { sourceTestBase } = await import('./src/modules/accounting/server/source-test-fixtures.ts');
      const { org, tenant, user, project } = await sourceTestBase(tx);
      const cash = await tx.ledgerAccount.create({ data: { organizationId:org.id, code:'100', name:'Cash', type:'ASSET' } });
      const income = await tx.ledgerAccount.create({ data: { organizationId:org.id, code:'400', name:'Income', type:'INCOME' } });
      for (let day=0; day<=30; day++) {
        const entry = await tx.journalEntry.create({ data: {
          organizationId:org.id, code:'J'+String(day).padStart(3,'0'), date:day ? new Date(Date.UTC(2026,0,day)) : new Date('2025-12-31'),
          description:'Report fixture', status:'DRAFT', createdById:user.id
        } });
        await tx.journalLine.createMany({data:[{journalEntryId:entry.id,organizationId:org.id,accountId:cash.id,debit:day?1:2,projectId:project.id},{journalEntryId:entry.id,organizationId:org.id,accountId:income.id,credit:day?1:2,projectId:project.id}]});
        await tx.journalEntry.update({where:{id:entry.id},data:{status:'POSTED',postedById:user.id,postedAt:new Date()}});
      }
      globalThis.reportTestDb = tx;
      globalThis.reportTestCtx = { org, tenant, user, isAdmin:true, permissions:new Set(['accounting.view']) };
      const dbPath=require.resolve('./src/core/db.ts');
      const ctxPath=require.resolve('./src/core/context.ts');
      const savedDb=require.cache[dbPath], savedCtx=require.cache[ctxPath];
      require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{db:{...tx,$transaction:async work=>work(tx)}}};
      require.cache[ctxPath]={id:ctxPath,filename:ctxPath,loaded:true,exports:{requireOrgContext:async()=>globalThis.reportTestCtx,assertPermission:()=>{}}};
      try {
        const { reportsData } = await import('./src/modules/accounting/server/reports.ts');
        const filter={from:'2026-01-01',to:'2026-01-31',accountId:cash.id,projectId:project.id};
        const ledger = (await reportsData(org.slug,{...filter,page:'2'},'ledger')).ledger;
        assert.equal(ledger.total,30); assert.equal(ledger.rows.length,5);
        assert.equal(ledger.openingBalance,'2.00'); assert.equal(ledger.rows[0].balance,'28.00');
        assert.equal(ledger.rows.at(-1).balance,'32.00'); assert.equal(ledger.closingBalance,'32.00');
        assert.ok(ledger.rows.every(row=>row.journalId));
        const last = (await reportsData(org.slug,{...filter,page:'999999'},'ledger')).ledger;
        assert.equal(last.page,2); assert.equal(last.rows.length,5);
        const trial = (await reportsData(org.slug,filter,'trial-balance')).trialBalance;
        assert.equal(trial.debitTotal,'32.00'); assert.equal(trial.creditTotal,'32.00');
        const pnl = (await reportsData(org.slug,filter,'profit-loss')).profitLoss;
        assert.equal(pnl.netProfit,'30.00');
        const bs = (await reportsData(org.slug,filter,'balance-sheet')).balanceSheet;
        assert.equal(bs.totalAssets,'32.00'); assert.equal(bs.retainedProfit,'32.00'); assert.equal(bs.difference,'0.00');
        assert.deepEqual((await reportsData(org.slug,filter,'tax')).tax.rows,[]);
      } finally { if(savedDb) require.cache[dbPath]=savedDb; else delete require.cache[dbPath]; if(savedCtx) require.cache[ctxPath]=savedCtx; else delete require.cache[ctxPath]; delete globalThis.reportTestDb; delete globalThis.reportTestCtx; }
    });
    console.log('report database checks passed');
  `,
      ],
      { encoding: "utf8", cwd: process.cwd(), timeout: 90000 },
    );
    assert.match(output, /report database checks passed/);
  },
);
