'use client'
import Image from 'next/image';import Link from 'next/link';import {useEffect,useState} from 'react';import {supabase} from '@/lib/supabase'
import Shell from '@/components/Shell'
const db=supabase

export default function DeletedOrders(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false)
 async function load(){const {data,error}=await db.from('orders').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false});if(error)setMsg(error.message);else{setRows(data||[]);setSelected([])}}
 useEffect(()=>{load()},[])
 const allSelected=rows.length>0&&selected.length===rows.length
 function toggle(id:string){setSelected(x=>x.includes(id)?x.filter(v=>v!==id):[...x,id])}
 function toggleAll(){setSelected(allSelected?[]:rows.map(o=>o.id))}
 async function restore(id:string){const {error}=await db.from('orders').update({deleted_at:null}).eq('id',id);if(error)setMsg(error.message);else{setMsg('Order restored.');load()}}
 async function restoreSelected(){if(!selected.length)return;if(!window.confirm(`Restore ${selected.length} selected order${selected.length>1?'s':''}?`))return;setBusy(true);const {error}=await db.from('orders').update({deleted_at:null}).in('id',selected);setBusy(false);if(error)setMsg(error.message);else{setMsg(`${selected.length} order${selected.length>1?'s':''} restored.`);load()}}
 async function forever(id:string){if(!window.confirm('Permanently delete this order? This cannot be undone.'))return;const {error}=await db.from('orders').delete().eq('id',id);if(error)setMsg(error.message);else{setMsg('Order permanently deleted.');load()}}
 async function foreverSelected(){if(!selected.length)return;if(!window.confirm(`Permanently delete ${selected.length} selected order${selected.length>1?'s':''}? This cannot be undone.`))return;setBusy(true);const {error}=await db.from('orders').delete().in('id',selected);setBusy(false);if(error)setMsg(error.message);else{setMsg(`${selected.length} order${selected.length>1?'s':''} permanently deleted.`);load()}}
 return <Shell active="Orders"><div className="top"><div><div className="title">Deleted History</div><div className="sub">Restore orders or permanently delete them</div></div><Link className="btn" href="/orders">← Back to Orders</Link></div>
 {msg&&<div className="msg">{msg}</div>}
 <div className="card">
  <div style={{marginBottom:14,padding:12,borderRadius:9,background:'#fff8df',color:'#7d6200',fontSize:13}}>Permanent delete cannot be undone. Use Restore if you only want to remove the deleted status.</div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:14}}>
   <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button className={allSelected?'primary':'btn'} onClick={toggleAll}>{allSelected?'Clear Selection':'Select All'}</button><span className="sub">{selected.length} selected</span></div>
   {selected.length>0&&<div className="actionRow"><button className="primary" onClick={restoreSelected} disabled={busy}>Restore Selected ({selected.length})</button><button className="danger" onClick={foreverSelected} disabled={busy}>Delete Selected Forever ({selected.length})</button></div>}
  </div>
  <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th style={{width:46}}><input type="checkbox" aria-label="Select all deleted orders" checked={allSelected} onChange={toggleAll}/></th><th>Collection Date</th><th>Type</th><th>Customer</th><th>Phone</th><th>Florist</th><th>Amount</th><th>Deleted</th><th>Actions</th></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><input type="checkbox" aria-label={`Select ${o.customer_name||'order'}`} checked={selected.includes(o.id)} onChange={()=>toggle(o.id)}/></td><td><strong className="collectionDate">{o.collection_date||'-'}</strong></td><td>{o.order_type==='Others'&&o.other_item_type?`Others · ${o.other_item_type}`:o.order_type}</td><td>{o.customer_name||'-'}</td><td>{o.customer_phone||'-'}</td><td>{o.florist_name||'-'}</td><td>RM {Number(o.amount||0).toFixed(2)}</td><td>{o.deleted_at?new Date(o.deleted_at).toLocaleString(): '-'}</td><td><div className="actionRow"><button className="primary" onClick={()=>restore(o.id)}>Restore</button><button className="danger" onClick={()=>forever(o.id)}>Delete Forever</button></div></td></tr>)}{!rows.length&&<tr><td colSpan={9} className="sub">No deleted orders.</td></tr>}</tbody></table></div>
 </div></Shell>}
