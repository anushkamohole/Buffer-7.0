import { jsPDF } from 'jspdf';
import { Download } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';
import { SCENARIOS } from '../engine/Scenarios';

/**
 * ReportExporter — Generates a PDF report.
 * Uses simplified currency (USD/Rs.) to avoid character set issues in jsPDF.
 */
export default function ReportExporter({
  networkData,
  sccData,
  cascadeResult,
  explanations = [],
  contagionPathData,
  rescueData,
  mcResult,
  currency,
  currentScenarioId,
}) {
  const handleExport = () => {
    try {
      const doc = new jsPDF();
      const scenario = SCENARIOS.find(s => s.id === currentScenarioId);
      const scenarioName = scenario ? scenario.name : 'Unknown Scenario';
      const timestamp = new Date().toLocaleString();

      // Normalize currency symbol for PDF (jsPDF standard fonts don't support ₹)
      const pdfCurrency = currency === 'INR' ? 'Rs.' : '$';

      // Helper for currency formatting in PDF
      const pdfFmt = (v) => {
        const val = formatCurrency(v, currency);
        return val.replace('₹', 'Rs.').replace('$', '$ ');
      };

      const addSection = (title, y) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text(title, 20, y);
        doc.line(20, y + 2, 190, y + 2);
        return y + 10;
      };

      // ── PAGE 1: EXECUTIVE SUMMARY ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 100);
      doc.text('Financial Contagion Analysis', 20, 30);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`CASCADING LIQUIDITY SIMULATOR | Generated: ${timestamp}`, 20, 38);
      
      let y = 55;
      y = addSection('1. Network Topology Overview', y);
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Scenario: ${scenarioName}`, 25, y);
      doc.text(`Entity Count: ${networkData.nodes.length}`, 25, y + 6);
      doc.text(`Exposure Count: ${networkData.edges.length}`, 25, y + 12);
      const totalCap = networkData.nodes.reduce((s, n) => s + n.capital, 0);
      doc.text(`Total Systemic Capital: ${pdfFmt(totalCap)}`, 25, y + 18);
      y += 30;

      y = addSection('2. Structural Fragility Analysis', y);
      if (sccData?.length) {
        sccData.slice(0, 5).forEach((scc, i) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFont('helvetica', 'bold');
          doc.text(`SCC #${i + 1} - ${scc.classification || 'Risk Identified'}`, 25, y);
          doc.setFont('helvetica', 'normal');
          doc.text(`Fragility Index: ${scc.fragilityScore?.toFixed(3) || '0.000'}`, 25, y + 6);
          const members = (scc.members || []).map(id => networkData.nodes.find(n => n.id === id)?.name || id).join(', ');
          doc.text(`Nodes: ${members}`, 25, y + 12, { maxWidth: 160 });
          y += 22;
        });
      } else {
        doc.text('System is topologically stable (Acyclic).', 25, y);
        y += 10;
      }

      // ── PAGE 2: PROPAGATION RESULTS ──
      if (cascadeResult) {
        doc.addPage();
        y = 20;
        y = addSection('3. Contagion Propagation Results', y);
        
        doc.text(`Total Defaults: ${cascadeResult.totalDefaults}`, 25, y);
        doc.text(`Total Losses: ${pdfFmt(cascadeResult.totalSystemicLoss)}`, 25, y + 6);
        doc.text(`Survival Rate: ${(cascadeResult.survivalRate * 100).toFixed(1)}%`, 25, y + 12);
        y += 22;

        y = addSection('4. Failure Event Timeline', y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Round', 20, y);
        doc.text('Institution', 40, y);
        doc.text('Snapshot Capital', 140, y);
        doc.line(20, y + 2, 190, y + 2);
        y += 8;
        doc.setFont('helvetica', 'normal');

        explanations.slice(0, 30).forEach((exp) => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(exp.round.toString(), 20, y);
          doc.text(exp.nodeName || 'Unknown', 40, y);
          doc.text(pdfFmt(exp.capitalAfter), 140, y);
          y += 6;
        });
      }

      // ── PAGE 3: ADVANCED ANALYTICS ──
      if (mcResult || rescueData) {
        doc.addPage();
        y = 20;
        y = addSection('5. Probabilistic Tail-Risk (Monte Carlo)', y);
        if (mcResult) {
          doc.text(`Iterations: ${mcResult.iterations}`, 25, y);
          doc.text(`Value at Risk (VaR 95%): ${pdfFmt(mcResult.var95)}`, 25, y + 6);
          doc.text(`Extreme Tail Loss: ${pdfFmt(mcResult.worstCase)}`, 25, y + 12);
          y += 25;
        } else {
          doc.text('Monte Carlo simulation not executed.', 25, y);
          y += 15;
        }

        y = addSection('6. Systemic Liquidity Rescue Flow', y);
        if (rescueData) {
          doc.text(`Maximum Rescue Flow: ${pdfFmt(rescueData.maxFlow)}`, 25, y);
          const b = rescueData.bottleneckEdge;
          if (b) {
            const n1 = networkData.nodes.find(n => n.id === b[0])?.name || b[0];
            const n2 = networkData.nodes.find(n => n.id === b[1])?.name || b[1];
            doc.text(`Systemic Bottleneck: ${n1} -> ${n2}`, 25, y + 6);
          }
        } else {
          doc.text('Rescue capacity not computed.', 25, y);
        }
      }

      doc.save(`CLCS_Analysis_Report_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('PDF generation failed. Please check the console for details.');
    }
  };

  return (
    <button className="export-btn" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Download size={15} />
      Export Analysis Report (PDF)
    </button>
  );
}
