import { FixedSizeList as _FixedSizeList, ListChildComponentProps } from 'react-window';

/**
 * Virtualized list component using react-window.
 * 
 * Note: Originally part of applesauce integration, but simplified to just
 * use react-window directly for performance with large datasets.
 * 
 * Renders only visible items for performance with large datasets (>25 items).
 */
type VirtualizedListProps = {
  height: number;
  itemCount: number;
  itemSize: number;
  width?: number | string;
  children: (props: ListChildComponentProps) => JSX.Element;
};

/**
 * Virtualized list component using react-window.
 * Renders only visible items for performance with large datasets (>25 items).
 * 
 * @param props - VirtualizedListProps
 * @returns Virtualized FixedSizeList component
 */
export function VirtualizedList({ height, itemCount, itemSize, width = '100%', children }: VirtualizedListProps) {
  return (
    <_FixedSizeList
      height={height}
      itemCount={itemCount}
      itemSize={itemSize}
      width={width}
    >
      {children}
    </_FixedSizeList>
  );
}

