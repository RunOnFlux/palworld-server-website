import { Grid, List } from 'react-window';
import { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Virtualized File List Component
 * Uses react-window v2 for efficient rendering of large file lists
 * Supports both grid and list view modes
 */

/**
 * VirtualizedFileList Component
 * @param {Array} files - Array of file objects to display
 * @param {Function} renderFile - Function to render each file (file, index) => React.Node
 * @param {boolean} isGridView - Whether to use grid view (true) or list view (false)
 * @param {number} itemHeight - Height of each item in pixels (list view only)
 * @param {number} itemWidth - Width of each item in pixels (grid view only)
 * @param {number} gridColumns - Number of columns in grid view
 */
const VirtualizedFileList = ({
  files,
  renderFile,
  isGridView = false,
  itemHeight = 80,
  itemWidth = 180,
  gridColumns: _gridColumns = 4,
}) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 448 }); // 480px - 32px padding

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Measure immediately on mount
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      setDimensions({
        width: rect.width || 1200,
        height: rect.height || 468
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: width || 1200, height: height || 468 });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (files.length === 0) {
    return null;
  }

  if (isGridView) {
    // Grid View Cell Component
    const GridCell = ({ columnIndex, rowIndex, style, files, renderFile, columns }) => {
      const index = rowIndex * columns + columnIndex;

      if (index >= files.length) {
        return <div style={style} />;
      }

      const file = files[index];
      // Add padding to create gaps between grid items
      const cellStyle = {
        ...style,
        padding: '8px',
        boxSizing: 'border-box',
      };
      return <div style={cellStyle}>{renderFile(file, index, files.length)}</div>;
    };

    const containerWidth = dimensions.width - 16; // Subtract scrollbar width
    const containerHeight = dimensions.height;
    const actualColumns = Math.max(1, Math.floor(containerWidth / itemWidth));
    const actualRows = Math.ceil(files.length / actualColumns);
    // Adjust column width to fill entire container width
    const adjustedColumnWidth = Math.floor(containerWidth / actualColumns);

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <Grid
          key={`${containerWidth}-${containerHeight}-${files.length}`}
          cellComponent={GridCell}
          cellProps={{
            files,
            renderFile,
            columns: actualColumns,
          }}
          columnCount={actualColumns}
          columnWidth={adjustedColumnWidth}
          height={Math.max(containerHeight, 448)}
          rowCount={actualRows}
          rowHeight={itemHeight + 20}
          width={containerWidth}
          style={{
            overflowY: 'auto',
            overflowX: 'visible',
          }}
          className="custom-scrollbar"
        />
      </div>
    );
  }

  // List View Row Component
  const ListRow = ({ index, style, files, renderFile }) => {
    const file = files[index];
    return <div style={style}>{renderFile(file, index, files.length)}</div>;
  };

  // List View
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <List
        key={`${dimensions.width}-${dimensions.height}-${files.length}`}
        rowComponent={ListRow}
        rowProps={{
          files,
          renderFile,
        }}
        rowCount={files.length}
        rowHeight={itemHeight}
        height={Math.max(dimensions.height, 448)}
        width={dimensions.width - 16}
        style={{
          overflowY: 'auto',
          overflowX: 'visible',
        }}
        className="custom-scrollbar"
      />
    </div>
  );
};

VirtualizedFileList.propTypes = {
  files: PropTypes.array.isRequired,
  renderFile: PropTypes.func.isRequired,
  isGridView: PropTypes.bool,
  itemHeight: PropTypes.number,
  itemWidth: PropTypes.number,
  gridColumns: PropTypes.number,
};

export default VirtualizedFileList;
