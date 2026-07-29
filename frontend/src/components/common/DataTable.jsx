import React from 'react';

export function DataTable({ columns = [], data = [], emptyMessage = "No records found." }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              {columns.map((col, idx) => (
                <th key={col.key || col.accessor || idx} className="py-3 px-4">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {data.length > 0 ? (
              data.map((row, rowIdx) => (
                <tr key={row._id || row.id || rowIdx} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((col, colIdx) => {
                    // 1. Check for any standard cell render function
                    const renderFunc = col.cell || col.renderCell || col.render;
                    
                    // 2. Fall back to property key / accessor
                    const dataKey = col.accessor || col.key;

                    return (
                      <td key={col.key || col.accessor || colIdx} className="py-3.5 px-4 font-medium">
                        {renderFunc 
                          ? renderFunc(row) 
                          : (dataKey && row[dataKey] !== undefined ? row[dataKey] : '')}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length || 1} className="py-8 text-center text-slate-400 text-xs">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;