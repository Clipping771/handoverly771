const fs = require('fs');

const path = 'src/app/admin/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Icons
if (!content.includes('UserPlus')) {
  content = content.replace("from 'lucide-react';", "UserPlus, Edit3, Save, from 'lucide-react';".replace(", from", " from"));
}

// 2. Add Editing States
if (!content.includes('const [editingStaffId')) {
  const stateInjection = `
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'rn' | 'carer' | 'admin'>('carer');
  const [editStaffEmployeeId, setEditStaffEmployeeId] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
`;
  content = content.replace("const [staffEmail, setStaffEmail] = useState('');", "const [staffEmail, setStaffEmail] = useState('');" + stateInjection);
}

// 3. Add Handlers
if (!content.includes('const handleDeleteStaff')) {
  const handlers = `
  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(\`Are you sure you want to delete \${name}? This will revoke their access.\`)) return;
    try {
      const res = await fetch('/api/auth/delete-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error('Failed to delete staff member');
      setFeedback(\`Staff member \${name} deleted successfully.\`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete staff member');
    }
  };

  const handleUpdateStaff = async (id: string) => {
    try {
      const res = await fetch('/api/auth/update-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: editStaffName,
          role: editStaffRole,
          employeeId: editStaffEmployeeId,
          email: editStaffEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update staff member');
      setFeedback('Staff member updated successfully.');
      setEditingStaffId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update staff member');
    }
  };
`;
  content = content.replace('const handleAddStaff = async', handlers + '\n  const handleAddStaff = async');
}

// 4. Inject UI Panel
if (!content.includes('STAFF MANAGEMENT')) {
  const uiPanel = `
          {/* STAFF MANAGEMENT */}
          <div className="space-y-8 bg-white/80 dark:bg-[#0d1326]/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/5 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-500/5 dark:from-slate-500/10 to-transparent pointer-events-none"></div>
            
            <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-4 text-slate-800 dark:text-slate-100 relative">
              <div className="p-2 bg-slate-100 dark:bg-slate-1000/10 rounded-xl">
                <Users className="w-5 h-5 text-slate-800 dark:text-slate-300" />
              </div>
              Staff Management
            </h3>

            {/* Add Staff Form */}
            <div className="bg-slate-50/50 dark:bg-white/[0.02] p-6 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-inner">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Register New Staff</h4>
              <form onSubmit={handleAddStaff} className="grid sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-1">Name</label>
                  <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-1">Employee ID</label>
                  <input type="text" value={staffEmployeeId} onChange={(e) => setStaffEmployeeId(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="EMP123" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-1">Email</label>
                  <input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-1">Password</label>
                  <input type="password" value={staffPin} onChange={(e) => setStaffPin(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="Min 6 chars" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-1">Role</label>
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as any)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-2 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50">
                      {rolesList.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="h-11 px-4 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Staff List */}
            {staffList.length > 0 && (
              <div className="mt-6">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-b border-slate-200/50 dark:border-white/5 pb-2 mb-4">Active Staff</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-white/[0.02]">
                      <tr>
                        <th className="px-4 py-3 font-semibold rounded-tl-xl">Name</th>
                        <th className="px-4 py-3 font-semibold">Employee ID</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold rounded-tr-xl text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {staffList.map(member => (
                        <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                            {editingStaffId === member.id ? (
                              <input type="text" value={editStaffName} onChange={e => setEditStaffName(e.target.value)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                            ) : member.name}
                          </td>
                          <td className="px-4 py-3">
                            {editingStaffId === member.id ? (
                              <input type="text" value={editStaffEmployeeId} onChange={e => setEditStaffEmployeeId(e.target.value)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                            ) : member.employee_id}
                          </td>
                          <td className="px-4 py-3">
                            {editingStaffId === member.id ? (
                              <input type="email" value={editStaffEmail} onChange={e => setEditStaffEmail(e.target.value)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                            ) : member.email}
                          </td>
                          <td className="px-4 py-3 capitalize">
                            {editingStaffId === member.id ? (
                              <select value={editStaffRole} onChange={e => setEditStaffRole(e.target.value as any)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none">
                                {rolesList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                              </select>
                            ) : (
                              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold">{member.role}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {editingStaffId === member.id ? (
                                <>
                                  <button onClick={() => handleUpdateStaff(member.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg">
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingStaffId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingStaffId(member.id); setEditStaffName(member.name); setEditStaffRole(member.role as any); setEditStaffEmployeeId(member.employee_id || ''); setEditStaffEmail(member.email || ''); }} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteStaff(member.id, member.name)} className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
`;
  content = content.replace('{/* CUSTOM ROLES MANAGEMENT */}', uiPanel + '\n          {/* CUSTOM ROLES MANAGEMENT */}');
}

fs.writeFileSync(path, content);
console.log('Admin UI updated.');
