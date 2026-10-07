'use client'
import Image from 'next/image'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import Shell from '@/components/Shell'

const db=supabase

export default function Florists(){
  const [rows,setRows]=useState<any[]>([])
  const [name,setName]=useState('')
  const [editingId,setEditingId]=useState<string|null>(null)
  const [editingName,setEditingName]=useState('')
  const [msg,setMsg]=useState('')

  async function load(){
    const {data,error}=await db.from('florists').select('*').order('name')
    if(error)setMsg(error.message); else setRows(data||[])
  }
  useEffect(()=>{load()},[])

  async function add(){
    setMsg('')
    const value=name.trim()
    if(!value){setMsg('Please enter a florist name.');return}
    const {error}=await db.from('florists').insert({name:value,active:true})
    if(error)setMsg(error.message)
    else{setName('');setMsg('Florist added successfully.');load()}
  }
  function startEdit(x:any){setEditingId(x.id);setEditingName(x.name);setMsg('')}
  function cancelEdit(){setEditingId(null);setEditingName('')}
  async function saveEdit(){
    const value=editingName.trim()
    if(!editingId||!value){setMsg('Please enter a florist name.');return}
    const {error}=await db.from('florists').update({name:value}).eq('id',editingId)
    if(error)setMsg(error.message)
    else{cancelEdit();setMsg('Florist name updated successfully.');load()}
  }
  async function toggle(id:string,active:boolean){
    const {error}=await db.from('florists').update({active:!active}).eq('id',id)
    if(error)setMsg(error.message); else load()
  }
  async function remove(x:any){
    if(!window.confirm(`Delete florist "${x.name}"? This cannot be undone.`))return
    const {error}=await db.from('florists').delete().eq('id',x.id)
    if(error)setMsg(error.message)
    else{setMsg('Florist deleted.');load()}
  }

  return <Shell active="Orders">
    <div className="top">
      <div><div className="title">Florists</div><div className="sub">Register and manage florist names</div></div>
      <Link className="btn" href="/">← Back</Link>
    </div>
    {msg&&<div className="msg">{msg}</div>}
    <div className="card">
      <div style={{display:'flex',gap:10,marginBottom:18}}>
        <input placeholder="New florist name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add()}} style={{flex:1,padding:11,border:'1px solid #dfe1e5',borderRadius:8}}/>
        <button className="primary" onClick={add}>Add Florist</button>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Status</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
        <tbody>
          {rows.map(x=><tr key={x.id}>
            <td>{editingId===x.id?<input autoFocus value={editingName} onChange={e=>setEditingName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')cancelEdit()}} style={{width:'100%',padding:8,border:'1px solid #dfe1e5',borderRadius:8}}/>:x.name}</td>
            <td>{x.active?'Active':'Inactive'}</td>
            <td style={{textAlign:'right'}}>
              {editingId===x.id
                ? <div style={{display:'inline-flex',gap:7}}><button className="primary" onClick={saveEdit}>Save</button><button onClick={cancelEdit}>Cancel</button></div>
                : <div style={{display:'inline-flex',gap:7}}><button onClick={()=>startEdit(x)}>Edit</button><button onClick={()=>toggle(x.id,x.active)}>{x.active?'Deactivate':'Activate'}</button><button className="danger" onClick={()=>remove(x)}>Delete</button></div>}
            </td>
          </tr>)}
          {!rows.length&&<tr><td colSpan={3} className="sub">No florists registered yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>
}
