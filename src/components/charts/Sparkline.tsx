import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showEndDot?: boolean;
}

type Coord = {
  x: number;
  y: number;
};

function buildSmoothPath(coords: Coord[]) {
  if (coords.length === 0) return '';
  if (coords.length === 1) {
    return `M ${coords[0].x} ${coords[0].y}`;
  }

  let path = `M ${coords[0].x} ${coords[0].y}`;

  for (let index = 0; index < coords.length - 1; index += 1) {
    const current = coords[index];
    const next = coords[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

export function Sparkline({
  data,
  width = 400,
  height = 56,
  color = 'rgba(255,255,255,0.82)',
  showEndDot = false,
}: SparklineProps) {
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const allZero = !data || data.length === 0 || data.every((value) => value === 0);

  if (allZero) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <motion.line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.9"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.45 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
    );
  }

  const { linePath, endPoint } = useMemo(() => {
    const points = data.length === 1 ? [data[0], data[0]] : data;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    const coords = points.map((value, index) => ({
      x: pad + (index / (points.length - 1)) * w,
      y: pad + h - ((value - min) / range) * h,
    }));

    const smoothLine = buildSmoothPath(coords);
    const last = coords[coords.length - 1];

    return {
      linePath: smoothLine,
      endPoint: last,
    };
  }, [data, h, pad, w]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.45 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      {showEndDot && !allZero ? (
        <motion.circle
          cx={endPoint.x}
          cy={endPoint.y}
          r="3.5"
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.24, delay: 0.9, ease: 'easeOut' }}
        />
      ) : null}
    </svg>
  );
}
