import { useState } from 'react'
import { auth } from '../firebase'
import { FileText, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

export default function ReportingHub() {
  const [scope, setScope] = useState<'self' | 'org'>('self')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePreview = async () => {
    setLoading(true)
    setError('')
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/reports/${scope}?format=json`, {
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        credentials: 'include'
      })
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have permission to view org reports.')
        throw new Error('Failed to load report data')
      }
      const data = await res.json()
      setPreviewData(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/reports/${scope}?format=csv`, {
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to export CSV')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${scope}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const exportPDF = () => {
    if (previewData.length === 0) {
      alert('Generate a preview first to export PDF')
      return
    }
    const doc = new jsPDF()
    doc.text(`KanbanKC ${scope === 'org' ? 'Organization' : 'Personal'} Report`, 14, 15)
    
    const head = [['ID', 'Title', 'Assignee', 'Status', 'Priority', 'Completed']]
    const body = previewData.map(row => [
      row['Task ID'].substring(row['Task ID'].length - 6), // abbreviate ID
      row['Title'],
      row['Assignee'],
      row['Status'],
      row['Priority'],
      row['Completion Date'] ? new Date(row['Completion Date']).toLocaleDateString() : ''
    ])

    autoTable(doc, {
      head,
      body,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    })
    
    doc.save(`report-${scope}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[var(--text1)]">Reporting & Analytics</h2>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-2xl mb-6">
        <h3 className="text-[var(--text1)] font-bold mt-0 mb-4">Report Configuration</h3>
        <div className="flex gap-4 items-end">
          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Scope
            <select value={scope} onChange={e => setScope(e.target.value as any)} className="px-3 py-2 bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] rounded-lg">
              <option value="self">My Tasks</option>
              <option value="org">Organization Tasks (Admin/C-Grade)</option>
            </select>
          </label>
          <button className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition-all" onClick={handlePreview} disabled={loading}>
            {loading ? 'Loading...' : 'Preview Data'}
          </button>
        </div>
        {error && <p className="text-red-500 font-semibold mt-4">{error}</p>}
      </div>

      <div className="flex-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 text-[var(--text1)] font-bold">Data Preview <span className="text-sm font-normal text-[var(--text2)] ml-2">{previewData.length} records</span></h3>
          <div className="flex gap-3">
            <button className="bg-emerald-500 text-white rounded-xl px-4 py-2 font-semibold flex items-center gap-2 hover:opacity-90 transition-all" onClick={exportCSV}>
              <Download size={16} /> Export CSV
            </button>
            <button className="bg-rose-500 text-white rounded-xl px-4 py-2 font-semibold flex items-center gap-2 hover:opacity-90 transition-all" onClick={exportPDF}>
              <FileText size={16} /> Export PDF
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[var(--bg)] sticky top-0">
              <tr>
                <th className="px-3 py-3 text-[var(--text2)] font-semibold border-b border-[var(--border)]/50">Title</th>
                <th className="px-3 py-3 text-[var(--text2)] font-semibold border-b border-[var(--border)]/50">Assignee</th>
                <th className="px-3 py-3 text-[var(--text2)] font-semibold border-b border-[var(--border)]/50">Status</th>
                <th className="px-3 py-3 text-[var(--text2)] font-semibold border-b border-[var(--border)]/50">Priority</th>
                <th className="px-3 py-3 text-[var(--text2)] font-semibold border-b border-[var(--border)]/50">Completion Date</th>
                <th className="px-3 py-3 text-[var(--text2)] font-semibold border-b border-[var(--border)]/50">Time to Complete (Hrs)</th>
              </tr>
            </thead>
            <tbody>
              {previewData.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-[var(--text2)]">No data to preview. Run configuration above.</td></tr>
              ) : (
                previewData.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--bg)] transition-all">
                    <td className="px-3 py-3 text-[var(--text1)] border-b border-[var(--border)]/50">{row['Title']}</td>
                    <td className="px-3 py-3 text-[var(--text2)] border-b border-[var(--border)]/50">{row['Assignee']}</td>
                    <td className="px-3 py-3 border-b border-[var(--border)]/50"><span className="text-xs px-2 py-1 bg-[var(--border)] text-[var(--text1)] rounded-full">{row['Status']}</span></td>
                    <td className="px-3 py-3 border-b border-[var(--border)]/50"><span className="text-xs px-2 py-1 bg-[var(--border)] text-[var(--text1)] rounded-full">{row['Priority']}</span></td>
                    <td className="px-3 py-3 text-[var(--text2)] border-b border-[var(--border)]/50">{row['Completion Date'] ? new Date(row['Completion Date']).toLocaleDateString() : '-'}</td>
                    <td className="px-3 py-3 text-[var(--text2)] border-b border-[var(--border)]/50">{row['Time-to-Complete (Hours)'] || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
