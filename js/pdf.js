// Rapport hebdo des visites en PDF (jsPDF, dans le navigateur)
import { S } from './db.js';
import { cfg } from './ref.js';
import { dateFr, today } from './util.js';
import { client, clientName, activite, semaine } from './metrics.js';

const BLUE = [27, 109, 181];

function header(doc, titre, sousTitre) {
  doc.setFillColor(...BLUE); doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('ALPAGEL', 14, 16);
  doc.setFontSize(13); doc.text(titre, 196, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(sousTitre, 196, 19, { align: 'right' });
  doc.setTextColor(20);
}

export function rapportHebdo(dateStr = today()) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { lundi, dimanche } = semaine(dateStr);
  const conf = cfg();
  header(doc, 'Rapport hebdomadaire', `Semaine du ${dateFr(lundi)} au ${dateFr(dimanche)}${conf.nom ? ' · ' + conf.nom : ''}`);
  const vis = S.visites.filter(v => v.date >= lundi && v.date <= dimanche).sort((a, b) => a.date.localeCompare(b.date));
  const cmds = vis.filter(v => v.resultat === 'Commande prise');
  const nouveaux = S.clients.filter(c => c.depuis && c.depuis >= lundi && c.depuis <= dimanche);
  const a = activite(7);
  doc.setFontSize(11);
  const vus = new Set(vis.map(v => v.clientId)).size;
  const kpis = [
    ['Visites', String(vis.length)], ['Clients vus', String(vus)], ['Visites avec commande', String(cmds.length)],
    ['Visites par jour travaillé', a.parJour.toFixed(1)], ['Nouveaux clients', String(nouveaux.length)],
  ];
  doc.autoTable({ startY: 34, body: kpis, theme: 'grid', styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }, tableWidth: 120 });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8, head: [['Date', 'Client', 'Ville', 'Résultat', 'Compte rendu']],
    body: vis.map(v => { const c = client(v.clientId) || {}; return [dateFr(v.date), clientName(v.clientId), c.ville || '', v.resultat || '', v.note || '']; }),
    styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: BLUE }, columnStyles: { 4: { cellWidth: 70 } },
  });
  const pipe = S.clients.filter(c => c.statut === 'prospect' || c.etape === 'Gagné').filter(c => (c.etapeDate || '') >= lundi);
  if (pipe.length) doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8, head: [['Prospect', 'Ville', 'Étape']],
    body: pipe.map(c => [c.enseigne || c.nom, c.ville || '', c.etape || '']), styles: { fontSize: 9 }, headStyles: { fillColor: BLUE },
  });
  doc.setFontSize(9); doc.setTextColor(110);
  return doc.output('blob');
}
