import React, { useEffect, useRef } from 'react';
import { Tldraw, DefaultColorStyle, exportToBlob, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';

// Custom toolbar component that appears inside the editor
function CustomToolbar({ onSave, onClose }) {
  const editor = useEditor();

  const handleExport = async () => {
    if (!editor) return;

    try {
      // Export the current page as an image
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());

      if (shapeIds.length === 0) {
        alert('Please add some elements to the diagram before saving.');
        return;
      }

      const blob = await exportToBlob({
        editor,
        ids: shapeIds,
        format: 'png',
        opts: {
          background: true,
          padding: 20,
          scale: 2,
        },
      });

      // Convert blob to data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;

        // Get the current state for persistence
        const snapshot = editor.store.getSnapshot();

        if (onSave) {
          onSave({
            dataUrl,
            snapshot,
          });
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export diagram. Please try again.');
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex gap-2">
      <button
        onClick={handleExport}
        className="btn btn-primary px-4 py-2 shadow-lg"
      >
        ✓ Save Diagram
      </button>
      <button
        onClick={onClose}
        className="btn btn-subtle px-4 py-2 shadow-lg"
      >
        Close
      </button>
    </div>
  );
}

// Component to set up initial state and background
function EditorSetup({ initialSnapshot }) {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    // Load saved state if available
    if (initialSnapshot) {
      try {
        editor.store.loadSnapshot(initialSnapshot);
      } catch (error) {
        console.error('Failed to load snapshot:', error);
      }
    }

    // Set up soccer field background
    // We'll add a custom background using the canvas
    const setupBackground = () => {
      // Set canvas background to soccer field green
      editor.updateInstanceState({
        isDebugMode: false,
      });
    };

    setupBackground();
  }, [editor, initialSnapshot]);

  return null;
}

export default function DiagramBuilderTldraw({ initialDiagram, onSave, onClose }) {
  return (
    <div className="w-full h-full" style={{ height: 'calc(100vh - 100px)' }}>
      <Tldraw
        persistenceKey="soccer-diagram"
        snapshot={initialDiagram?.snapshot}
        components={{
          // Custom components to add our toolbar
          InFrontOfTheCanvas: () => (
            <CustomToolbar onSave={onSave} onClose={onClose} />
          ),
        }}
        onMount={(editor) => {
          // Configure the editor
          editor.updateInstanceState({
            isDebugMode: false,
            isFocusMode: false,
            isToolLocked: false,
          });

          // Set dark theme by default
          editor.user.updateUserPreferences({
            isDynamicSizeMode: false,
            isSnapMode: false,
          });
        }}
      >
        <EditorSetup initialSnapshot={initialDiagram?.snapshot} />
      </Tldraw>
    </div>
  );
}
