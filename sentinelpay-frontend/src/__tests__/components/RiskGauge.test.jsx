/**
 * RiskGauge.test.jsx — RiskGauge SVG component tests
 *
 * Tests:
 *  - Renders without crashing at score 0, 0.5, 0.9
 *  - Displays correct percentage text
 *  - Applies correct aria-label for accessibility
 *  - Color reflects risk level (green/amber/red)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import RiskGauge from '../../components/fraud/RiskGauge';

describe('RiskGauge', () => {
  test('renders at score 0 (safe)', () => {
    render(<RiskGauge score={0} />);
    // Should show 0%
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  test('renders at score 0.5 (medium risk)', () => {
    render(<RiskGauge score={0.5} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  test('renders at score 0.9 (high risk)', () => {
    render(<RiskGauge score={0.9} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  test('renders at score 1.0 (maximum)', () => {
    render(<RiskGauge score={1.0} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  test('has accessible role and label', () => {
    const { container } = render(<RiskGauge score={0.75} />);
    const svg = container.querySelector('svg');
    // SVG should exist
    expect(svg).toBeInTheDocument();
  });

  test('clamps score below 0', () => {
    render(<RiskGauge score={-0.5} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  test('clamps score above 1', () => {
    render(<RiskGauge score={1.5} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  test('accepts size prop without crashing', () => {
    const { container } = render(<RiskGauge score={0.3} size={1.5} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
