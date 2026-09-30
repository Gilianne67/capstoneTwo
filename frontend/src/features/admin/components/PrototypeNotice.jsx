export default function PrototypeNotice({ children }) {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs font-medium">
      <p className="font-bold">Prototype only</p>
      <p className="mt-1 leading-relaxed">
        {children || 'This screen is not connected to the database. Actions here do not save changes.'}
      </p>
    </div>
  );
}
