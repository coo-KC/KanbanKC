import { useQuery } from '@tanstack/react-query'
import { auth } from '../firebase'
import { BACKEND_URL } from '../config'

const fetchUsers = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

// Recursive component to render the tree
const TreeNode = ({ node }: { node: any }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="px-6 py-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl min-w-[220px] text-center shadow-sm">
        <div className="font-semibold text-[var(--text1)] text-base">{node.name || node.email}</div>
        {node.username && <div className="text-sm text-[var(--accent)] my-1">@{node.username}</div>}
        <div className="text-xs text-[var(--text2)] capitalize mt-1">
          {node.role} {node.department ? `· ${node.department}` : ''}
        </div>
      </div>
      
      {node.children && node.children.length > 0 && (
        <div className="flex gap-8 relative pt-4">
          {/* Simple visual connector line from parent to children block */}
          <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-[var(--border)] -translate-x-1/2" />
          {node.children.map((child: any) => <TreeNode key={child._id} node={child} />)}
        </div>
      )}
    </div>
  )
}

export default function KCTree() {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers
  })

  if (isLoading) return <div className="p-8 text-[var(--text1)]">Loading KC Tree...</div>
  if (error) return <div className="p-8 text-red-400">Error loading tree: {error.message}</div>

  // 1. Build a map of all users by their _id
  const userMap = new Map()
  users.forEach((u: any) => {
    userMap.set(u._id, { ...u, children: [] })
  })

  // 2. Identify the root nodes (users with no superior)
  const roots: any[] = []
  
  userMap.forEach((user) => {
    if (user.superior && userMap.has(user.superior)) {
      const parent = userMap.get(user.superior)
      parent.children.push(user)
    } else {
      roots.push(user)
    }
  })

  return (
    <div className="flex flex-col items-center min-w-max">
      <h2 className="text-2xl font-bold text-[var(--text1)] mb-10">KC Tree (Organization Hierarchy)</h2>
      
      {roots.length === 0 ? (
        <p className="text-[var(--text2)]">No organization members found.</p>
      ) : (
        <div className="flex gap-16 items-start">
          {roots.map(rootNode => (
            <TreeNode key={rootNode._id} node={rootNode} />
          ))}
        </div>
      )}
    </div>
  )
}
