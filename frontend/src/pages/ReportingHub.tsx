import { useState } from 'react'
import { auth } from '../firebase'
import { FileText, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BACKEND_URL } from '../config'

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
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text1)]">Reporting & Analytics</h2>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-6 rounded-2xl">
        <h3 className="text-[var(--text1)] font-bold mt-0 mb-3 text-sm sm:text-base">Report Configuration</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end w-full">
          <label className="flex-1 flex flex-col gap-1.5 font-semibold text-[var(--text1)] text-xs sm:text-sm">
            Scope
            <select value={scope} onChange={e => setScope(e.target.value as any)} className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] rounded-xl text-xs sm:text-sm outline-none focus:border-[var(--accent)]">
              <option value="self">My Tasks</option>
              <option value="org">Organization Tasks (Admin/C-Grade)</option>
            </select>
          </label>
          <button className="w-full sm:w-auto px-4 py-2 bg-[var(--accent)] text-white rounded-xl font-semibold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0" onClick={handlePreview} disabled={loading}>
            {loading ? 'Loading...' : 'Preview Data'}
          </button>
        </div>
        {error && <p className="text-red-500 font-semibold text-xs sm:text-sm mt-3">{error}</p>}
      </div>

      <div className="flex-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h3 className="m-0 text-[var(--text1)] font-bold text-sm sm:text-base flex items-center gap-2">
            Data Preview <span className="text-xs font-normal text-[var(--text2)]">({previewData.length} records)</span>
          </h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-all cursor-pointer" onClick={exportCSV}>
              <Download size={14} /> Export CSV
            </button>
            <button className="flex-1 sm:flex-none bg-rose-600 text-white rounded-xl px-3 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-all cursor-pointer" onClick={exportPDF}>
              <FileText size={14} /> Export PDF
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
