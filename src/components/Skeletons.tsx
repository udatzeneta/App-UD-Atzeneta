import React from 'react';

// Skeletons para emular carga de datos y wow-factor inicial

export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-brand-black-card border border-brand-black-border p-6 rounded-xl">
          <div className="h-4 w-24 bg-brand-black-border rounded mb-3"></div>
          <div className="h-8 w-16 bg-brand-black-border rounded mb-2"></div>
          <div className="h-3 w-32 bg-brand-black-border rounded"></div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full bg-brand-black-card border border-brand-black-border rounded-xl overflow-hidden animate-pulse">
      <div className="h-12 bg-brand-black-hover border-b border-brand-black-border flex items-center px-6">
        <div className="h-4 w-1/4 bg-brand-black-border rounded"></div>
        <div className="h-4 w-1/4 bg-brand-black-border rounded ml-auto"></div>
      </div>
      <div className="divide-y divide-brand-black-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 flex items-center px-6 gap-4">
            <div className="h-4 w-12 bg-brand-black-border rounded"></div>
            <div className="h-4 w-full bg-brand-black-border rounded"></div>
            <div className="h-4 w-24 bg-brand-black-border rounded"></div>
            <div className="h-4 w-16 bg-brand-black-border rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-brand-black-card border border-brand-black-border p-6 rounded-xl animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-5 w-1/3 bg-brand-black-border rounded"></div>
        <div className="h-5 w-5 bg-brand-black-border rounded-full"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-brand-black-border rounded"></div>
        <div className="h-4 w-5/6 bg-brand-black-border rounded"></div>
        <div className="h-4 w-2/3 bg-brand-black-border rounded"></div>
      </div>
      <div className="h-4 w-20 bg-brand-black-border rounded mt-4"></div>
    </div>
  );
};
