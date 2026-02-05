import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';

const TransformerWrapper = ({ selectedShapeIds, layerRef }) => {
  const transformerRef = useRef(null);

  useEffect(() => {
    if (!transformerRef.current || !layerRef?.current) return;

    const transformer = transformerRef.current;
    const layer = layerRef.current;

    if (selectedShapeIds.length === 0) {
      transformer.nodes([]);
      return;
    }

    // Find all selected shape nodes
    const nodes = selectedShapeIds
      .map((id) => layer.findOne(`#${id}`))
      .filter(Boolean);

    transformer.nodes(nodes);
    layer.batchDraw();
  }, [selectedShapeIds, layerRef]);

  if (selectedShapeIds.length === 0) {
    return null;
  }

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled={true}
      enabledAnchors={[
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'middle-left',
        'middle-right',
        'top-center',
        'bottom-center',
      ]}
      boundBoxFunc={(oldBox, newBox) => {
        // Limit minimum size
        if (newBox.width < 10 || newBox.height < 10) {
          return oldBox;
        }
        return newBox;
      }}
      anchorSize={8}
      anchorCornerRadius={2}
      anchorStroke="#3B82F6"
      anchorFill="#FFFFFF"
      borderStroke="#3B82F6"
      borderStrokeWidth={2}
      borderDash={[4, 4]}
    />
  );
};

export default TransformerWrapper;
