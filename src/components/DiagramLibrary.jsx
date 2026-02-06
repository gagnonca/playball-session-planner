import React, { useState } from 'react';

export default function DiagramLibrary({ teamsContext, diagramLibrary }) {
  const {
    selectedTeamId,
    selectedSessionId,
    selectedSectionId,
    navigateToTeams,
    navigateToSessionBuilder,
    navigateToEditLibraryDiagram,
    navigateToDiagramBuilder,
    getSession,
    updateSession,
  } = teamsContext;

  const { diagrams, deleteDiagram, duplicateDiagram } = diagramLibrary;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgeGroup, setFilterAgeGroup] = useState('');
  const [filterMoment, setFilterMoment] = useState('');
  const [filterType, setFilterType] = useState('');

  // Check if we're in insert mode (coming from a section)
  const isInsertMode = selectedTeamId && selectedSessionId && selectedSectionId;

  // Get unique tags from all diagrams for filter dropdowns
  const uniqueAgeGroups = [...new Set(diagrams.map(d => d.tags?.ageGroup).filter(Boolean))];
  // Flatten moments arrays and get unique values (also handle legacy single moment)
  // Normalize to capitalized form to avoid duplicates from casing differences
  const uniqueMoments = [...new Set(diagrams.flatMap(d => {
    const moments = d.tags?.moments || [];
    const legacyMoment = d.tags?.moment;
    return [...(Array.isArray(moments) ? moments : []), ...(legacyMoment ? [legacyMoment] : [])];
  }).filter(Boolean).map(m => {
    // Normalize: capitalize first letter of each word
    return m.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }))];
  const uniqueTypes = [...new Set(diagrams.map(d => d.tags?.type).filter(Boolean))];

  // Filter diagrams by search and tags
  const filteredDiagrams = diagrams.filter(diagram => {
    const matchesSearch = !searchQuery ||
      diagram.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (diagram.description && diagram.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesAge = !filterAgeGroup || diagram.tags?.ageGroup === filterAgeGroup;

    // Handle moments filter - check both array and legacy single moment
    // Play type diagrams match all moments (they're not moment-specific)
    // Use case-insensitive comparison to handle old lowercase and new capitalized values
    const diagramMoments = diagram.tags?.moments || [];
    const legacyMoment = diagram.tags?.moment;
    const allMoments = [...(Array.isArray(diagramMoments) ? diagramMoments : []), ...(legacyMoment ? [legacyMoment] : [])];
    const isPlay = diagram.tags?.type === 'Play';
    const matchesMoment = !filterMoment || isPlay ||
      allMoments.some(m => m.toLowerCase() === filterMoment.toLowerCase());

    // Handle type filter
    const matchesType = !filterType || diagram.tags?.type === filterType;

    return matchesSearch && matchesAge && matchesMoment && matchesType;
  });

  const handleBack = () => {
    if (isInsertMode) {
      navigateToSessionBuilder(selectedTeamId, selectedSessionId);
    } else {
      navigateToTeams();
    }
  };

  const handleCreateNew = () => {
    if (isInsertMode) {
      // Go to diagram builder with section context
      navigateToDiagramBuilder(selectedTeamId, selectedSessionId, selectedSectionId);
    } else {
      // Create new standalone diagram - navigate to builder without context
      navigateToEditLibraryDiagram(null);
    }
  };

  const handleEdit = (diagramId) => {
    navigateToEditLibraryDiagram(diagramId);
  };

  const handleDelete = (diagramId, name) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteDiagram(diagramId);
    }
  };

  const handleDuplicate = (diagramId) => {
    duplicateDiagram(diagramId);
  };

  const handleInsert = (diagram) => {
    // Insert diagram into section
    const session = getSession(selectedTeamId, selectedSessionId);
    if (session) {
      const updatedSections = session.sections.map(section =>
        section.id === selectedSectionId
          ? {
              ...section,
              diagramData: {
                dataUrl: diagram.dataUrl,
                elements: diagram.elements || [],
                lines: diagram.lines || [],
                fieldType: diagram.fieldType || 'full',
              },
              imageDataUrl: diagram.dataUrl,
            }
          : section
      );
      updateSession(selectedTeamId, selectedSessionId, { sections: updatedSections });
    }
    navigateToSessionBuilder(selectedTeamId, selectedSessionId);
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Diagram Library</h1>
              {isInsertMode && (
                <p className="text-sm text-slate-400">Select a diagram to insert</p>
              )}
            </div>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            + New Diagram
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search diagrams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {uniqueAgeGroups.length > 0 && (
            <select
              value={filterAgeGroup}
              onChange={(e) => setFilterAgeGroup(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Ages</option>
              {uniqueAgeGroups.map(age => (
                <option key={age} value={age}>{age}</option>
              ))}
            </select>
          )}
          {uniqueMoments.length > 0 && (
            <select
              value={filterMoment}
              onChange={(e) => setFilterMoment(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Moments</option>
              {uniqueMoments.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          {uniqueTypes.length > 0 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {(filterAgeGroup || filterMoment || filterType) && (
            <button
              onClick={() => { setFilterAgeGroup(''); setFilterMoment(''); setFilterType(''); }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Diagram Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        {filteredDiagrams.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-slate-500 text-lg mb-4">
              {searchQuery ? 'No diagrams match your search' : 'No diagrams saved yet'}
            </div>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Create your first diagram
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDiagrams.map(diagram => (
              <div
                key={diagram.id}
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-slate-900 relative">
                  {diagram.dataUrl ? (
                    <img
                      src={diagram.dataUrl}
                      alt={diagram.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      No preview
                    </div>
                  )}
                  {isInsertMode && (
                    <button
                      onClick={() => handleInsert(diagram)}
                      className="absolute inset-0 bg-blue-600/80 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <span className="text-white font-bold text-lg">Insert</span>
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-100 truncate">{diagram.name}</h3>
                  {diagram.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{diagram.description}</p>
                  )}
                  {(diagram.tags?.ageGroup || diagram.tags?.type || diagram.tags?.moments?.length > 0 || diagram.tags?.moment) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {diagram.tags?.type && (
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          diagram.tags.type === 'Play'
                            ? 'bg-blue-600/30 text-blue-300'
                            : 'bg-green-600/30 text-green-300'
                        }`}>{diagram.tags.type}</span>
                      )}
                      {diagram.tags?.ageGroup && (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">{diagram.tags.ageGroup}</span>
                      )}
                      {/* Show moments array if present */}
                      {diagram.tags?.moments?.length > 0 && diagram.tags.moments.map(m => (
                        <span key={m} className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded">{m}</span>
                      ))}
                      {/* Fallback to legacy single moment if no moments array */}
                      {(!diagram.tags?.moments || diagram.tags.moments.length === 0) && diagram.tags?.moment && (
                        <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded">{diagram.tags.moment}</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Updated {formatDate(diagram.updatedAt)}
                  </p>

                  {/* Actions */}
                  {!isInsertMode && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleEdit(diagram.id)}
                        className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(diagram.id)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm rounded transition-colors"
                        title="Duplicate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(diagram.id, diagram.name)}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
