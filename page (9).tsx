'use client'
import Image from 'next/image'
import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {supabase} from '@/lib/supabase'
import Shell from '@/components/Shell'
const db=supabase
const fulfilmentLabel=(v:string)=>v==='delivery'?'Delivery':v==='walk_in'?'Walk In':'Self Pick'
const monthLabel=(ym:string)=>{const [y,m]=ym.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-MY',{month:'short',year:'numeric'})}
export default function Reports(){
 const [rows,setRows]=useState<any[]>([]),[from,setFrom]=useState(''),[to,setTo]=useState(''),[type,setType]=useState('All'),[msg,setMsg]=useState(''),[exporting,setExporting]=useState(false)
 async function load(){const {data,error}=await db.from('orders').select('*').is('deleted_at',null).order('order_date',{ascending:true});if(error)setMsg(error.message);else setRows(data||[])}useEffect(()=>{load()},[])
 const types=['All',...Array.from(new Set(rows.map(o=>o.order_type).filter(Boolean)))],filtered=rows.filter(o=>(!from||o.order_date>=from)&&(!to||o.order_date<=to)&&(type==='All'||o.order_type===type)),salesRows=filtered.filter(o=>o.status!=='cancelled'),total=salesRows.reduce((s,o)=>s+Number(o.amount||0),0)
 const byType=useMemo(()=>{const m=new Map<string,{orders:number,qty:number,sales:number}>();for(const o of salesRows){const key=o.order_type==='Others'&&o.other_item_type?`Others · ${o.other_item_type}`:(o.order_type||'Others');const x=m.get(key)||{orders:0,qty:0,sales:0};x.orders++;x.qty+=Number(o.quantity||1);x.sales+=Number(o.amount||0);m.set(key,x)}return [...m.entries()].sort((a,b)=>b[1].sales-a[1].sales)},[salesRows])
 const byMonth=useMemo(()=>{const m=new Map<string,number>();for(const o of salesRows){const key=(o.order_date||'').slice(0,7);if(key)m.set(key,(m.get(key)||0)+Number(o.amount||0))}return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0]))},[salesRows])
 const monthlyTypeData=useMemo(()=>{const map=new Map<string,Map<string,number>>();for(const o of salesRows){const month=(o.order_date||'').slice(0,7);if(!month)continue;const item=o.order_type==='Others'&&o.other_item_type?`Others · ${o.other_item_type}`:(o.order_type||'Others');if(!map.has(month))map.set(month,new Map());const mm=map.get(month)!;mm.set(item,(mm.get(item)||0)+Number(o.amount||0))}return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,types])=>({month,types,total:[...types.values()].reduce((s,v)=>s+v,0)}))},[salesRows])
 const monthlyTypeKeys=useMemo(()=>Array.from(new Set(monthlyTypeData.flatMap(x=>[...x.types.keys()]))).sort(),[monthlyTypeData])
 const byFloristGroup=useMemo(()=>{const m=new Map<string,{florist:string,item:string,qty:number,sales:number,orders:number}>();for(const o of salesRows){const florist=o.florist_name||'Unassigned',item=o.order_type==='Others'&&o.other_item_type?`Others · ${o.other_item_type}`:(o.order_type||'Others'),key=florist+'||'+item,x=m.get(key)||{florist,item,qty:0,sales:0,orders:0};x.qty+=Number(o.quantity||1);x.sales+=Number(o.amount||0);x.orders++;m.set(key,x)}return [...m.values()].sort((a,b)=>a.florist.localeCompare(b.florist)||a.item.localeCompare(b.item))},[salesRows])
 const floristDetailRows=useMemo(()=>salesRows.map(o=>({florist:o.florist_name||'Unassigned',orderDate:o.order_date||'',item:o.order_type==='Others'&&o.other_item_type?`Others · ${o.other_item_type}`:(o.order_type||'Others'),qty:Number(o.quantity||1),amount:Number(o.amount||0),orderId:o.id,customer:o.customer_name||''})).sort((a,b)=>a.florist.localeCompare(b.florist)||a.orderDate.localeCompare(b.orderDate)||a.item.localeCompare(b.item)||a.orderId.localeCompare(b.orderId)),[salesRows])
 const floristNames=useMemo(()=>Array.from(new Set(floristDetailRows.map(x=>x.florist))),[floristDetailRows])
 const exportRows=filtered.map(o=>({'Order ID':o.id,'Order Date':o.order_date||'','Collection Date':o.collection_date||'','Collection Time':o.time_from&&o.time_to?`${o.time_from} - ${o.time_to}`:(o.time_from||o.time_to||''),'Occasion':o.occasion||'','Order Type':o.order_type||'','Other Item Type':o.other_item_type||'','Quantity':Number(o.quantity||1),'Unit Price (RM)':Number(o.unit_price||0),'Total Amount (RM)':Number(o.amount||0),'Customer Name':o.customer_name||'','Phone':o.customer_phone||'','Florist':o.florist_name||'','Fulfilment':fulfilmentLabel(o.fulfilment),'Delivery Address':o.address||'','Wishing Card':o.wishing_card?'Yes':'No','Wishing Message':o.wishing_message||'','Status':o.status||'','Remarks':o.remarks||'','Reference Image URL':o.reference_image_url||''}))
 function exportExcel(){
  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.json_to_sheet(exportRows.length?exportRows:[{'Order ID':'No records'}]);
  XLSX.utils.book_append_sheet(wb,ws1,'Overall Orders');
  const ws2=XLSX.utils.json_to_sheet(byType.map(([item,x])=>({'Order Type':item,'Orders':x.orders,'Quantity':x.qty,'Sales (RM)':x.sales})));
  XLSX.utils.book_append_sheet(wb,ws2,'Sales by Order Type');
  const ws3=XLSX.utils.json_to_sheet(byFloristGroup.map(x=>({'Florist':x.florist,'Item Group':x.item,'Orders':x.orders,'Quantity':x.qty,'Sales (RM)':x.sales})));
  XLSX.utils.book_append_sheet(wb,ws3,'Florist Item Summary');
  const floristDetailExport=floristDetailRows.map(x=>({'Florist':x.florist,'Order Date':x.orderDate,'Item Type':x.item,'Quantity':x.qty,'Amount (RM)':x.amount,'Customer':x.customer,'Order ID':x.orderId}));
  const ws4=XLSX.utils.json_to_sheet(floristDetailExport.length?floristDetailExport:[{'Florist':'No records'}]);
  XLSX.utils.book_append_sheet(wb,ws4,'Florist Sales Detail');
  for(const florist of floristNames){
    const rows=floristDetailRows.filter(x=>x.florist===florist);
    const data=[
      ['Florist Sales Detail'],
      ['Florist',florist],
      ['Date Range',`${from||'All'} to ${to||'All'}`],
      ['Total Orders',rows.length],
      ['Total Quantity',rows.reduce((n,x)=>n+x.qty,0)],
      ['Total Sales (RM)',rows.reduce((n,x)=>n+x.amount,0)],
      [],
      ['Order Date','Item Type','Quantity','Amount (RM)','Customer','Order ID']
    ];
    for(const x of rows)data.push([x.orderDate,x.item,x.qty,x.amount,x.customer,x.orderId]);
    const ws=XLSX.utils.aoa_to_sheet(data);
    const safe=(florist||'Unassigned').replace(/[\\\/?*\[\]:]/g,' ').trim().slice(0,31)||'Unassigned';
    let name=safe,i=2;while(wb.SheetNames.includes(name)){name=safe.slice(0,28)+` ${i++}`}
    XLSX.utils.book_append_sheet(wb,ws,name);
  }
  const ws5=XLSX.utils.json_to_sheet(byMonth.map(([month,sales])=>({'Month':monthLabel(month),'Sales (RM)':sales})));
  XLSX.utils.book_append_sheet(wb,ws5,'Monthly Sales');
  const ws6=XLSX.utils.json_to_sheet(monthlyTypeData.map(row=>{const out:any={Month:monthLabel(row.month)};monthlyTypeKeys.forEach(k=>out[k]=row.types.get(k)||0);out['Total Sales (RM)']=row.total;return out}));
  XLSX.utils.book_append_sheet(wb,ws6,'Monthly Order Type Sales');
  XLSX.writeFile(wb,`Monet_Garden_Sales_Report_${new Date().toISOString().slice(0,10)}.xlsx`)
 }
 async function exportFullPackage(){
  setExporting(true);setMsg('');
  try{
    const zip=new JSZip(),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(exportRows.length?exportRows:[{'Order ID':'No records'}]),'Overall Orders');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(byType.map(([item,x])=>({'Order Type':item,'Orders':x.orders,'Quantity':x.qty,'Sales (RM)':x.sales}))),'Sales by Order Type');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(byFloristGroup.map(x=>({'Florist':x.florist,'Item Group':x.item,'Orders':x.orders,'Quantity':x.qty,'Sales (RM)':x.sales}))),'Florist Item Summary');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(floristDetailRows.map(x=>({'Florist':x.florist,'Order Date':x.orderDate,'Item Type':x.item,'Quantity':x.qty,'Amount (RM)':x.amount,'Customer':x.customer,'Order ID':x.orderId}))), 'Florist Sales Detail');
    for(const florist of floristNames){
      const rows=floristDetailRows.filter(x=>x.florist===florist);
      const data=[['Florist Sales Detail'],['Florist',florist],['Date Range',`${from||'All'} to ${to||'All'}`],['Total Orders',rows.length],['Total Quantity',rows.reduce((n,x)=>n+x.qty,0)],['Total Sales (RM)',rows.reduce((n,x)=>n+x.amount,0)],[],['Order Date','Item Type','Quantity','Amount (RM)','Customer','Order ID']];
      for(const x of rows)data.push([x.orderDate,x.item,x.qty,x.amount,x.customer,x.orderId]);
      const ws=XLSX.utils.aoa_to_sheet(data);const safe=(florist||'Unassigned').replace(/[\\\/?*\[\]:]/g,' ').trim().slice(0,31)||'Unassigned';let name=safe,i=2;while(wb.SheetNames.includes(name)){name=safe.slice(0,28)+` ${i++}`}XLSX.utils.book_append_sheet(wb,ws,name);
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(byMonth.map(([month,sales])=>({'Month':monthLabel(month),'Sales (RM)':sales}))),'Monthly Sales');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(monthlyTypeData.map(row=>{const out:any={Month:monthLabel(row.month)};monthlyTypeKeys.forEach(k=>out[k]=row.types.get(k)||0);out['Total Sales (RM)']=row.total;return out})),'Monthly Order Type Sales');
    zip.file('Monet_Garden_Sales_Report.xlsx',XLSX.write(wb,{bookType:'xlsx',type:'array'}));
    const imageFolder=zip.folder('reference-images');let imageCount=0;
    for(const o of filtered){if(!o.reference_image_url)continue;try{const res=await fetch(o.reference_image_url);if(!res.ok)continue;const blob=await res.blob();const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');imageFolder?.file(`${o.id}_${(o.customer_name||'order').replace(/[^a-z0-9_-]+/gi,'_')}.${ext}`,blob);imageCount++}catch{}}
    zip.file('README.txt',`MONET GARDEN SALES EXPORT\n\nDate filter: ${from||'All'} to ${to||'All'}\nOrder type filter: ${type}\nSales calculations exclude cancelled orders.\nFlorist Sales Detail sheets are sorted by florist, then order date, then item type.\nReference images exported: ${imageCount}.`);
    const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Monet_Garden_Sales_Full_Export_${new Date().toISOString().slice(0,10)}.zip`;a.click();URL.revokeObjectURL(url);setMsg(`Full sales export ready: ${filtered.length} order records, ${floristNames.length} florist detail sheets and ${imageCount} reference images.`)
  }catch(e:any){setMsg(e?.message||'Unable to create full export.')}finally{setExporting(false)}
 }
 return <Shell active="Sales Report"><div className="top"><div><div className="title">Sales Analytics & Report</div><div className="sub">Select a date range to analyse sales, order types and florist performance.</div></div><Link className="btn" href="/">← Dashboard</Link></div>{msg&&<div className="msg">{msg}</div>}
 <div className="card report-filters" style={{marginBottom:16}}><div className="form"><div className="field"><label>Sales From Date</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="field"><label>Sales To Date</label><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><div className="field"><label>Order Type</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(x=><option key={x}>{x}</option>)}</select></div></div><div className="reportSummary"><div><span className="sub">Order records</span><b>{filtered.length}</b></div><div><span className="sub">Sales orders</span><b>{salesRows.length}</b></div><div><span className="sub">Sales</span><b className="redText">RM {total.toFixed(2)}</b></div><div className="reportActions"><button onClick={exportExcel}>Export Excel</button><button onClick={exportFullPackage} disabled={exporting}>{exporting?'Preparing…':'Export Full Package'}</button><button className="primary" onClick={()=>window.print()}>Print / PDF</button></div></div></div>
 <div className="analyticsGrid"><section className="card"><h2>Sales by Order Type</h2><div className="analyticsList">{byType.map(([item,x])=><div className="analyticsRow" key={item}><div><b>{item}</b><div className="sub">{x.orders} orders · {x.qty} items</div></div><strong>RM {x.sales.toFixed(2)}</strong></div>)}{!byType.length&&<div className="emptyState">No sales in this date range.</div>}</div></section><section className="card"><div className="sectionHead"><div><h2>Monthly Sales</h2><div className="sub">Sales amount by month</div></div><strong className="redText" style={{fontSize:22}}>Total RM {total.toFixed(2)}</strong></div><div className="monthlySalesTotal"><span>Total Sales in Selected Period</span><strong>RM {total.toFixed(2)}</strong></div><div className="monthlyChart">{byMonth.map(([month,sales])=>{const max=Math.max(...byMonth.map(x=>x[1]),1);return <div className="monthBar" key={month}><b className="monthAmount">RM {sales.toFixed(2)}</b><div className="barTrack"><div className="barFill" style={{height:`${Math.max(5,(sales/max)*100)}%`}}/></div><span>{monthLabel(month)}</span></div>})}{!byMonth.length&&<div className="emptyState">No monthly sales data.</div>}</div></section></div>
 <section className="card section"><div className="sectionHead"><div><h2>Monthly Sales by Order Type</h2><div className="sub">Monthly sales amount by order type. Cancelled orders are excluded.</div></div></div><div className="monthlyTypeChart"><div className="monthlyTypeLegend">{monthlyTypeKeys.map((k,i)=><span key={k}><i style={{background:`hsl(${(i*47)%360} 55% 48%)`}}></i>{k}</span>)}</div>{monthlyTypeData.map(row=><div className="monthlyTypeRow" key={row.month}><div className="monthlyTypeLabel">{monthLabel(row.month)}</div><div className="monthlyTypeStack" title={`${monthLabel(row.month)} · RM ${row.total.toFixed(2)}`}>{monthlyTypeKeys.map((k,i)=>{const value=row.types.get(k)||0;const pct=row.total?value/row.total*100:0;return pct>0?<span key={k} title={`${k}: RM ${value.toFixed(2)}`} style={{width:`${pct}%`,background:`hsl(${(i*47)%360} 55% 48%)`}}/>:null})}</div><strong>RM {row.total.toFixed(2)}</strong></div>)}{!monthlyTypeData.length&&<div className="emptyState">No monthly order type sales data.</div>}</div><div className="tableWrap" style={{marginTop:16}}><table className="table"><thead><tr><th>Month</th>{monthlyTypeKeys.map(k=><th key={k}>{k}</th>)}<th>Total Sales</th></tr></thead><tbody>{monthlyTypeData.map(row=><tr key={row.month}><td><strong>{monthLabel(row.month)}</strong></td>{monthlyTypeKeys.map(k=><td key={k}>RM {(row.types.get(k)||0).toFixed(2)}</td>)}<td><strong>RM {row.total.toFixed(2)}</strong></td></tr>)}</tbody></table></div></section>
 <section className="card section"><h2>Florist Sales by Item Group</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Florist</th><th>Item Group</th><th>Orders</th><th>Quantity</th><th>Sales</th></tr></thead><tbody>{byFloristGroup.map(x=><tr key={x.florist+'-'+x.item}><td>{x.florist}</td><td>{x.item}</td><td>{x.orders}</td><td>{x.qty}</td><td>RM {x.sales.toFixed(2)}</td></tr>)}</tbody></table>{!byFloristGroup.length&&<div className="emptyState">No florist sales data.</div>}</div></section>
 <section className="card section" id="sales-report-print"><h2>Overall Order Details</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Order Date</th><th>Collection Date</th><th>Time</th><th>Occasion</th><th>Type</th><th>Qty</th><th>Customer</th><th>Florist</th><th>Amount</th><th>Status</th><th>Remarks</th></tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td>{o.order_date||'-'}</td><td>{o.collection_date||'-'}</td><td>{o.time_from&&o.time_to?o.time_from+' - '+o.time_to:(o.time_from||o.time_to||'-')}</td><td>{o.occasion||'-'}</td><td>{o.order_type==='Others'&&o.other_item_type?`Others · ${o.other_item_type}`:o.order_type}</td><td>{o.quantity||1}</td><td>{o.customer_name||'-'}</td><td>{o.florist_name||'-'}</td><td>RM {Number(o.amount||0).toFixed(2)}</td><td>{o.status||'-'}</td><td>{o.remarks||'-'}</td></tr>)}</tbody></table></div></section>
 <style jsx global>{`@media print{.side,.top,.report-filters,.analyticsGrid{display:none!important}.main{margin:0!important;padding:0!important}.card{box-shadow:none!important;border:0!important}body{background:#fff!important}}`}</style></Shell>}
