import React, { useState, useEffect } from 'react';
import {
  Tldraw,
  BaseBoxShapeTool,
  BaseBoxShapeUtil,
  SVGContainer,
  exportToBlob,
  useEditor,
  Rectangle2d,
  resizeBox,
  T,
} from 'tldraw';
import 'tldraw/tldraw.css';

// ==============================================================================
// CONSTANTS
// ==============================================================================

const FIELD_TEMPLATES = [
  { id: 'full', label: 'Full Field', width: 1200, height: 800 },
  { id: 'half', label: 'Half Field', width: 1200, height: 600 },
  { id: 'quarter', label: 'Quarter Field', width: 900, height: 600 },
  { id: 'third', label: 'Third Field', width: 800, height: 600 },
];

const CONE_COLORS = [
  { label: 'Orange', color: '#FF6B35' },
  { label: 'Yellow', color: '#FDD835' },
  { label: 'Blue', color: '#42A5F5' },
  { label: 'Red', color: '#EF5350' },
  { label: 'Green', color: '#66BB6A' },
];

// ==============================================================================
// CUSTOM SHAPE UTILITIES
// ==============================================================================

// Attacker Shape (Circle with direction indicator)
class AttackerShapeUtil extends BaseBoxShapeUtil {
  static type = 'attacker';
  static props = { w: T.number, h: T.number };

  getDefaultProps() {
    return { w: 40, h: 40 };
  }

  getGeometry(shape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape) {
    const bounds = this.getGeometry(shape).bounds;
    const radius = Math.min(bounds.width, bounds.height) / 2;

    return (
      <SVGContainer>
        <circle cx={radius} cy={radius} r={radius - 2} fill="#EF4444" stroke="#000" strokeWidth={2} />
        <path d={\`M \${radius} \${radius * 0.3} L \${radius - 5} \${radius * 0.6} L \${radius + 5} \${radius * 0.6} Z\`} fill="#FFF" />
      </SVGContainer>
    );
  }

  indicator(shape) {
    const bounds = this.getGeometry(shape).bounds;
    const radius = Math.min(bounds.width, bounds.height) / 2;
    return <circle cx={radius} cy={radius} r={radius} />;
  }

  onResize(shape, info) {
    return resizeBox(shape, info);
  }
}

// Defender Shape (Triangle with direction indicator)
class DefenderShapeUtil extends BaseBoxShapeUtil {
  static type = 'defender';
  static props = { w: T.number, h: T.number };

  getDefaultProps() {
    return { w: 40, h: 40 };
  }

  getGeometry(shape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape) {
    const bounds = this.getGeometry(shape).bounds;
    const w = bounds.width;
    const h = bounds.height;

    return (
      <SVGContainer>
        <path d={\`M \${w / 2} 2 L \${w - 2} \${h - 2} L 2 \${h - 2} Z\`} fill="#3B82F6" stroke="#000" strokeWidth={2} />
        <path d={\`M \${w / 2} 2 L \${w / 2 + 8} \${h * 0.3} L \${w / 2 - 8} \${h * 0.3} Z\`} fill="#FFF" />
      </SVGContainer>
    );
  }

  indicator(shape) {
    const bounds = this.getGeometry(shape).bounds;
    const w = bounds.width;
    const h = bounds.height;
    return <path d={\`M \${w / 2} 0 L \${w} \${h} L 0 \${h} Z\`} />;
  }

  onResize(shape, info) {
    return resizeBox(shape, info);
  }
}

// Cone Shape (with color variants)
class ConeShapeUtil extends BaseBoxShapeUtil {
  static type = 'cone';
  static props = { w: T.number, h: T.number, color: T.string };

  getDefaultProps() {
    return { w: 30, h: 30, color: '#FF6B35' };
  }

  getGeometry(shape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape) {
    const bounds = this.getGeometry(shape).bounds;
    const scale = Math.min(bounds.width, bounds.height) / 200;
    const color = shape.props.color || '#FF6B35';

    return (
      <SVGContainer>
        <g transform={\`scale(\${scale})\`}>
          <path
            d="m7.07 126.41 54.83-76.61c.89-1.25 2.33-1.99 3.87-1.99h68.67c1.53 0 2.97.74 3.87 1.99l54.62 76.32c1.64 2.29.95 5.48-1.48 6.88-19.92 11.53-75.57 39.11-138.34 21.15-18.22-5.21-33.15-13.15-44.81-21.03-2.23-1.5-2.79-4.54-1.22-6.72z"
            fill={color}
            stroke="#231f20"
            strokeWidth={2}
          />
          <ellipse cx={100.1} cy={47.81} rx={36.78} ry={7.89} fill="#90330c" stroke="#231f20" strokeWidth={1.5} />
        </g>
      </SVGContainer>
    );
  }

  indicator(shape) {
    const bounds = this.getGeometry(shape).bounds;
    return <rect width={bounds.width} height={bounds.height} />;
  }

  onResize(shape, info) {
    return resizeBox(shape, info);
  }
}

// TODO: Add Ball, Goal, and other shapes following similar pattern

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================

export default function DiagramBuilderTldraw({ initialDiagram, onSave, onClose }) {
  const [diagramName, setDiagramName] = useState(initialDiagram?.name || '');

  const customShapeUtils = [AttackerShapeUtil, DefenderShapeUtil, ConeShapeUtil];
  const customTools = [];

  return (
    <div className="w-full h-full relative bg-slate-900">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <input
          type="text"
          value={diagramName}
          onChange={(e) => setDiagramName(e.target.value)}
          placeholder="Diagram name"
          className="input-field"
        />
        <button onClick={() => onSave({ name: diagramName })} className="btn btn-primary">
          Save
        </button>
        <button onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      </div>
      
      <Tldraw shapeUtils={customShapeUtils} tools={customTools} />
    </div>
  );
}
