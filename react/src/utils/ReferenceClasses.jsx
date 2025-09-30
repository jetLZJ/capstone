// This file exists solely to reference Tailwind classes that might be used dynamically
// This ensures they're included in the build even if they're not referenced in templates

export default function ReferenceClasses() {
  // This component is never rendered, it just ensures classes are included in the build
  return (
    <div className="hidden">
      {/* Font weights */}
      <span className="font-thin font-extralight font-light font-normal font-medium font-semibold font-bold font-extrabold font-black"></span>
      
      {/* Gray backgrounds */}
      <span className="bg-gray-50 bg-gray-100 bg-gray-200 bg-gray-300 bg-gray-400 bg-gray-500 bg-gray-600 bg-gray-700 bg-gray-800 bg-gray-900"></span>
      
      {/* Gray text */}
      <span className="text-gray-50 text-gray-100 text-gray-200 text-gray-300 text-gray-400 text-gray-500 text-gray-600 text-gray-700 text-gray-800 text-gray-900"></span>
      
      {/* Primary backgrounds */}
      <span className="bg-primary-50 bg-primary-100 bg-primary-200 bg-primary-300 bg-primary-400 bg-primary-500 bg-primary-600 bg-primary-700 bg-primary-800 bg-primary-900"></span>
      
      {/* Primary text */}
      <span className="text-primary-50 text-primary-100 text-primary-200 text-primary-300 text-primary-400 text-primary-500 text-primary-600 text-primary-700 text-primary-800 text-primary-900"></span>
      
      {/* Secondary backgrounds */}
      <span className="bg-secondary-50 bg-secondary-100 bg-secondary-200 bg-secondary-300 bg-secondary-400 bg-secondary-500 bg-secondary-600 bg-secondary-700 bg-secondary-800 bg-secondary-900"></span>
      
      {/* Secondary text */}
      <span className="text-secondary-50 text-secondary-100 text-secondary-200 text-secondary-300 text-secondary-400 text-secondary-500 text-secondary-600 text-secondary-700 text-secondary-800 text-secondary-900"></span>
      
      {/* Common button classes */}
      <button className="btn btn-primary btn-secondary btn-outline"></button>
      
      {/* Form input class */}
      <input className="input" />
      
      {/* Card class */}
      <div className="card"></div>
    </div>
  );
}