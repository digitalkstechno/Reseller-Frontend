'use client';

import { useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

interface SearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function Search({ onSearch, placeholder = 'Search by name, email, or more...' }: SearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  const handleReset = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <form noValidate
      onSubmit={handleSearch}
      className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-3 sm:px-5"
    >
      <div className="relative flex-1">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-sky-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {query && (
          <button
            type="button"
            onClick={handleReset}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          >
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-950 to-sky-950 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-sky-950 hover:to-sky-950 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-950 focus:ring-offset-2 active:scale-95 sm:flex-none"
        >
          <FiSearch className="h-4 w-4" />
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 active:scale-95 sm:hidden"
          >
            <FiX className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </form>
  );
}