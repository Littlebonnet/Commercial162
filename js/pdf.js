// Bons de commande et rapports hebdo en PDF (jsPDF, dans le navigateur)
import { S } from './db.js';
import { cfg } from './ref.js';
import { eur, dateFr, today, addDays, sum, pct } from './util.js';
import { client, clientName, ventesEntre, caOf, margeOf, objectifMois, thisMonth, monthRange, activite, prime, semaine } from './metrics.js';

const BLUE = [27, 109, 181];
const money = v => eur(v, true).replace(/ | /g, ' ');

function header(doc, titre, sousTitre) {
  doc.setFillColor(...BLUE); doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('ALPAGEL', 14, 16);
  doc.setFontSize(13); doc.text(titre, 196, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(sousTitre, 196, 19, { align: 'right' });
  doc.setTextColor(20);
}

export function bonDeCommande(cmd) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const c = client(cmd.clientId) || {};
  const conf = cfg();
  header(doc, 'Bon de commande', `N° ${cmd.numero || cmd.id.slice(-6).toUpperCase()} · ${dateFr(cmd.date)}`);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold'); doc.text('Client', 14, 36); doc.text('Commercial', 120, 36);
  doc.setFont('helvetica', 'normal');
  const cl = [c.enseigne || c.nom || '', c.enseigne && c.nom && c.nom !== c.enseigne ? c.nom : '', c.adresse || '', `${c.cp || ''} ${c.ville || ''}`.trim(),
    c.numClient ? 'N° client : ' + c.numClient : '', c.siret ? 'SIRET : ' + c.siret : ''].filter(Boolean);
  doc.text(cl, 14, 42);
  doc.text([conf.nom || '', conf.telephone || '', conf.email || ''].filter(Boolean), 120, 42);
  if (cmd.livraison) { doc.setFont('helvetica', 'bold'); doc.text('Livraison souhaitée : ' + dateFr(cmd.livraison, true), 120, 62); doc.setFont('helvetica', 'normal'); }
  doc.autoTable({
    startY: 74,
    head: [['Réf.', 'Désignation', 'Cond.', 'Qté', 'PU HT', 'Total HT']],
    body: cmd.lignes.map(l => [l.ref, l.designation, l.cond || '', l.qte, money(l.pu), money(l.qte * l.pu)]),
    styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: BLUE },
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 18 }, 3: { halign: 'right', cellWidth: 14 }, 4: { halign: 'right', cellWidth: 24 }, 5: { halign: 'right', cellWidth: 26 } },
  });
  let y = doc.lastAutoTable.finalY + 8;
  const ht = cmd.totalHT, tva = ht * (conf.tva || 5.5) / 100;
  doc.setFontSize(11);
  doc.text('Total HT', 150, y); doc.text(money(ht), 196, y, { align: 'right' });
  doc.text(`TVA ${conf.tva || 5.5} %`, 150, y + 6); doc.text(money(tva), 196, y + 6, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.text('Total TTC', 150, y + 13); doc.text(money(ht + tva), 196, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  if (cmd.note) { doc.setFontSize(10); doc.text(doc.splitTextToSize('Remarques : ' + cmd.note, 120), 14, y); }
  y += 30;
  doc.setFontSize(9); doc.setTextColor(110);
  doc.text('Bon pour accord (signature et cachet du client) :', 14, y);
  if (cmd.signature) doc.addImage(cmd.signature, 'PNG', 14, y + 3, 60, 24);
  return doc.output('blob');
}

export function rapportHebdo(dateStr = today()) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { lundi, dimanche } = semaine(dateStr);
  const conf = cfg();
  header(doc, 'Rapport hebdomadaire', `Semaine du ${dateFr(lundi)} au ${dateFr(dimanche)}${conf.nom ? ' · ' + conf.nom : ''}`);
  const vis = S.visites.filter(v => v.date >= lundi && v.date <= dimanche).sort((a, b) => a.date.localeCompare(b.date));
  const cmds = S.commandes.filter(c => c.date >= lundi && c.date <= dimanche && c.statut !== 'brouillon');
  const lines = ventesEntre(lundi, dimanche);
  const k = thisMonth(), [mFrom] = monthRange(k);
  const caMois = caOf(ventesEntre(mFrom, today()));
  const obj = objectifMois(k);
  const p = prime(k);
  const nouveaux = S.clients.filter(c => c.depuis && c.depuis >= lundi && c.depuis <= dimanche);
  const a = activite(7);
  doc.setFontSize(11);
  const kpis = [
    ['Visites', String(vis.length)], ['Commandes', String(cmds.length)], ['CA semaine', money(caOf(lines))], ['Marge semaine', money(margeOf(lines))],
    ['CA du mois', money(caMois)], ['Objectif du mois', obj ? money(obj) + ' (' + pct(caMois / obj * 100) + ')' : '—'],
    ['Nouveaux clients', String(nouveaux.length)], ['Prime estimée', money(p.total)],
  ];
  doc.autoTable({ startY: 34, body: kpis, theme: 'grid', styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }, tableWidth: 120 });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8, head: [['Date', 'Client', 'Ville', 'Résultat', 'Compte rendu']],
    body: vis.map(v => { const c = client(v.clientId) || {}; return [dateFr(v.date), clientName(v.clientId), c.ville || '', v.resultat || '', v.note || '']; }),
    styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: BLUE }, columnStyles: { 4: { cellWidth: 70 } },
  });
  if (cmds.length) doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8, head: [['Date', 'Client', 'Lignes', 'Total HT']],
    body: cmds.map(c => [dateFr(c.date), clientName(c.clientId), String(c.lignes.length), money(c.totalHT)]),
    styles: { fontSize: 9 }, headStyles: { fillColor: BLUE }, columnStyles: { 3: { halign: 'right' } },
  });
  const pipe = S.clients.filter(c => c.statut === 'prospect' || c.etape === 'Gagné').filter(c => (c.etapeDate || '') >= lundi);
  if (pipe.length) doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8, head: [['Prospect', 'Ville', 'Étape']],
    body: pipe.map(c => [c.enseigne || c.nom, c.ville || '', c.etape || '']), styles: { fontSize: 9 }, headStyles: { fillColor: BLUE },
  });
  doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`Visites par jour travaillé : ${a.parJour.toFixed(1)} · Taux visite → commande : ${Math.round(a.tauxVisiteCommande)} %`, 14, 287);
  return doc.output('blob');
}
