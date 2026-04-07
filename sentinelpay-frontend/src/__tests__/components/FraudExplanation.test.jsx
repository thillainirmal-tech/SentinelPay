/**
 * FraudExplanation.test.jsx — FraudExplanation panel tests
 *
 * Tests:
 *  - Renders nothing when result is null
 *  - Shows SAFE verdict correctly
 *  - Shows FRAUD verdict with blocked message
 *  - Shows REVIEW verdict with review notes
 *  - Renders confidence bar
 *  - Shows detection layer label
 */

/**
 * FraudExplanation.test.jsx — FraudExplanation panel tests
 *
 * IMPORTANT: FIXTURES.fraudResult.* are raw backend FraudResult DTOs (use `status`).
 * FraudExplanation expects normalized records (use `fraudStatus`).
 * All fixtures are normalized via normalizeTxRecord(null, fixture) before rendering,
 * which also validates the normalization pipeline end-to-end.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import FraudExplanation from '../../components/fraud/FraudExplanation';
import { normalizeTxRecord } from '../../utils/formatters';
import { FIXTURES } from '../../mocks/handlers';

// Normalize all test fixtures once — mirrors real app data flow:
//   raw FraudResult → normalizeTxRecord(null, raw) → component
const SAFE   = normalizeTxRecord(null, FIXTURES.fraudResult.safe);
const FRAUD  = normalizeTxRecord(null, FIXTURES.fraudResult.fraud);
const REVIEW = normalizeTxRecord(null, FIXTURES.fraudResult.review);

describe('FraudExplanation', () => {
  test('renders nothing when result is null', () => {
    const { container } = render(<FraudExplanation result={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders SAFE verdict', () => {
    render(<FraudExplanation result={SAFE} />);
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  test('renders FRAUD verdict with blocked headline', () => {
    render(<FraudExplanation result={FRAUD} />);
    expect(screen.getByText(/blocked — fraud detected/i)).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  test('renders REVIEW verdict', () => {
    render(<FraudExplanation result={REVIEW} />);
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
  });

  test('shows review notes when present', () => {
    render(<FraudExplanation result={REVIEW} />);
    expect(screen.getByText(/escalated for manual review/i)).toBeInTheDocument();
  });

  test('shows confidence score as percentage', () => {
    render(<FraudExplanation result={FRAUD} />);
    expect(screen.getByText('91%')).toBeInTheDocument();
  });

  test('shows AI detection layer label', () => {
    render(<FraudExplanation result={FRAUD} />);
    expect(screen.getByText(/AI \/ ML Model/i)).toBeInTheDocument();
  });

  test('shows RULE_BASED detection layer', () => {
    render(<FraudExplanation result={SAFE} />);
    expect(screen.getByText(/Rule-Based Engine/i)).toBeInTheDocument();
  });

  test('shows recommendation section', () => {
    render(<FraudExplanation result={FRAUD} />);
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
  });
});
