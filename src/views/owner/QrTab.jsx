import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { fetchTables, fetchTableQrTokens, fetchServerInfo } from '../../api/client';
import { CAFE_LOGO, CAFE_NAME, PLATFORM_COMPANY } from '../../utils/brand';

// The URL a table's QR points at. Customers scan it and land on the menu with
// their table already selected (CustomerView reads the table and signed QR token).
//
// Base URL: prefer the origin the owner is actually viewing (window.location) —
// that's the same public HTTPS address customers use on a cloud deploy, and the
// LAN address when the dashboard is opened via the shop's LAN IP. Only fall back
// to the server-reported LAN IP when the dashboard is opened on localhost (dev),
// because a QR saying "localhost" is useless to a phone. NOTE: os.networkInterfaces()
// (the server's lanIp) is a private/container IP on a cloud host, so it must NOT
// be used as the QR base in production — hence the origin-first order here.
function pickBaseUrl(info) {
  const strip = (u) => String(u || '').replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname);
    if (origin && !isLocal) return strip(origin);
  }
  return strip(info?.baseUrl);
}

const tableUrl = (base, table, token) =>
  `${base}/?t=${encodeURIComponent(table)}&q=${encodeURIComponent(token)}`;

function TableQr({ url, table, onCopy, copied, urlBytes }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1, color: { dark: '#292323' } });
    }
  }, [url]);
  return (
    <div className="rounded-2xl border border-espresso/10 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md">
      <div className="relative flex aspect-[3/2] flex-col overflow-hidden rounded-xl border border-espresso/15 bg-cream text-left">
        <header className="flex h-[20%] shrink-0 items-center gap-2 border-b border-espresso/10 px-3">
          <img src={CAFE_LOGO} alt="" className="size-8 shrink-0 object-contain" />
          <div className="shrink-0 leading-none">
            <p className="text-[10px] font-black tracking-tight text-bean">Tavrix</p>
            <p className="mt-1 text-[6px] font-bold tracking-[0.2em] text-espresso">DMMS</p>
          </div>
          <span className="h-6 border-l border-espresso/20" />
          <p className="flex-1 text-center text-[8px] font-black text-bean">
            SCAN <span className="text-chiya">·</span> TAP <span className="text-chiya">·</span> ENJOY
          </p>
          <span className="rounded-full bg-latte px-2 py-1 text-[8px] font-black text-espresso">
            TABLE {table}
          </span>
        </header>
        <main className="flex min-h-0 flex-1 items-center justify-center gap-3 px-3 py-2">
          <div className="flex h-full w-[46%] flex-col items-center justify-center gap-1">
            <div className="grid aspect-square w-[70%] max-w-[110px] flex-none place-items-center rounded-lg border-2 border-chiya bg-white p-1">
              <canvas ref={canvasRef} className="block" style={{ width: '100%', height: '100%' }} />
            </div>
            <p className="w-full rounded-full bg-chiya px-2 py-1 text-center text-[7px] font-black leading-tight text-white">
              SCAN QR TO VIEW MENU &amp; ORDER
            </p>
          </div>
          <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-espresso px-2 text-center text-white">
            <p className="text-[10px] font-black leading-tight"><span className="text-latte">TAP</span> YOUR PHONE</p>
            <svg viewBox="0 0 150 76" role="img" aria-label="Wi-Fi-style NFC waves beside a phone" className="my-1 h-[62%] w-full max-w-[135px] fill-none stroke-white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <g transform="rotate(90 49 37)">
                <path d="M23 29Q49 4 75 29M32 37Q49 21 66 37M41 45Q49 38 57 45" className="stroke-latte" />
                <circle cx="49" cy="51" r="2" className="fill-latte stroke-none" />
              </g>
              <g>
                <rect x="78" y="4" width="44" height="68" rx="8" />
                <path d="M93 11h14m-12 53h10" />
                <circle cx="100" cy="37" r="5" className="stroke-latte" />
                <circle cx="100" cy="37" r="1.5" className="fill-latte stroke-none" />
              </g>
            </svg>
          </div>
        </main>
        <footer className="flex h-[14%] shrink-0 items-center justify-between bg-espresso px-3 text-[7px] font-semibold text-white">
          <span>Powered by <strong className="text-[9px]">Tavrix</strong></span>
          <span className="text-center italic">A Smarter Dining Experience</span>
          <span><strong className="text-latte">{PLATFORM_COMPANY}</strong></span>
        </footer>
      </div>
      <p className={`mt-3 break-all text-left text-xs ${urlBytes > 137 ? 'text-red-600' : 'text-bean/60'}`}>
        NFC link · {urlBytes}/137 bytes
        <span className="mt-1 block font-mono">{url}</span>
      </p>
      <button
        type="button"
        onClick={() => onCopy(url, table)}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-espresso/15 px-3 text-sm font-bold text-espresso hover:bg-cream"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied NFC link' : 'Copy NFC link'}
      </button>
    </div>
  );
}

// Build two 150 × 100 mm landscape stands per A4 portrait page.
function buildPrintHtml(cards, logoDataUrl) {
  const pages = Array.from({ length: Math.ceil(cards.length / 2) }, (_, pageIndex) => {
    const pageCards = cards.slice(pageIndex * 2, pageIndex * 2 + 2);
    const cardMarkup = pageCards
      .map(
        ({ table, dataUrl }) => `
        <div class="card">
          <header class="header">
            <div class="brand">
              <img class="brand-logo" src="${logoDataUrl}" alt="" />
              <span class="brand-name">Tavrix<small>DMMS</small></span>
            </div>
            <span class="divider"></span>
            <p class="journey">SCAN <b>·</b> TAP <b>·</b> ENJOY</p>
            <span class="table-badge">TABLE ${table}</span>
          </header>
          <main class="content">
            <div class="qr-column">
              <div class="qr-frame">
                <img class="qr" src="${dataUrl}" alt="QR for table ${table}" />
              </div>
              <div class="scan-label">
                <strong>SCAN QR TO VIEW MENU &amp; ORDER</strong>
              </div>
            </div>
            <div class="nfc-panel">
              <div class="nfc-heading"><strong>TAP</strong> YOUR PHONE</div>
              <svg class="nfc-illustration" viewBox="0 0 150 76" role="img" aria-label="Wi-Fi-style NFC waves beside a phone">
                <g transform="rotate(90 49 37)">
                  <path class="radio-waves" d="M23 29Q49 4 75 29M32 37Q49 21 66 37M41 45Q49 38 57 45"/>
                  <circle cx="49" cy="51" r="2" class="radio-dot"/>
                </g>
                <g class="phone">
                  <rect x="78" y="4" width="44" height="68" rx="8"/>
                  <path d="M93 11h14m-12 53h10"/>
                  <circle cx="100" cy="37" r="5" class="tap-target"/>
                  <circle cx="100" cy="37" r="1.5" class="tap-dot"/>
                </g>
              </svg>
            </div>
          </main>
          <footer class="footer">
            <span class="powered"><span class="globe">◎</span><small>Powered by</small><strong>Tavrix</strong></span>
            <span class="tagline">A Smarter Dining Experience</span>
            <span class="company">by <strong>${PLATFORM_COMPANY}</strong></span>
          </footer>
        </div>
      `
      )
      .join('');
    return `<section class="page${pageIndex === Math.ceil(cards.length / 2) - 1 ? ' last-page' : ''}">${cardMarkup}</section>`;
  }).join('');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Table QR Codes — ${CAFE_NAME}</title>
<style>
  * { box-sizing: border-box; }
  html, body { width: 210mm; margin: 0; padding: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, sans-serif; }
  .page {
    width: 210mm;
    height: 297mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10mm;
    page-break-after: always;
    break-after: page;
  }
  .page.last-page { page-break-after: avoid; break-after: avoid; }
  .card {
    position: relative;
    flex: none;
    width: 150mm;
    height: 100mm;
    overflow: hidden;
    border: 0.45mm solid #f2d4d0;
    border-radius: 4mm;
    background: #fff8f6;
  }
  .header {
    position: absolute;
    inset: 0 0 auto;
    height: 19mm;
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 2mm 7mm;
    border-bottom: 0.3mm solid #f2d4d0;
    background: white;
  }
  .brand { display: flex; align-items: center; gap: 1.5mm; color: #292323; }
  .brand-logo { width: 13mm; height: 13mm; object-fit: contain; }
  .brand-name { font-size: 7mm; font-weight: 900; line-height: 0.78; letter-spacing: -0.4mm; }
  .brand-name small { display: block; margin-top: 1.2mm; font-size: 2.8mm; text-align: center; letter-spacing: 0.9mm; }
  .divider { height: 9mm; border-left: 0.4mm solid #f2d4d0; }
  .journey { flex: 1; margin: 0; color: #292323; font-size: 4mm; font-weight: 900; letter-spacing: 0.4mm; text-align: center; }
  .journey b { color: #c62832; }
  .table-badge { border-radius: 5mm; background: #f2d4d0; padding: 2mm 4mm; color: #8f1d27; font-size: 3mm; font-weight: 900; white-space: nowrap; }
  .content { position: absolute; inset: 22mm 12mm 19mm; display: flex; align-items: center; justify-content: center; gap: 8mm; }
  .qr-column { width: 53mm; height: 100%; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
  .qr-frame { width: 43mm; height: 43mm; display: grid; place-items: center; border: 1.2mm solid #c62832; border-radius: 3mm; background: white; padding: 2mm; }
  .qr { display: block; width: 100%; height: 100%; object-fit: contain; }
  .scan-label { width: 52mm; min-height: 7mm; display: grid; place-items: center; border-radius: 5mm; background: #c62832; color: white; text-align: center; }
  .scan-label strong { font-size: 2.5mm; letter-spacing: 0.1mm; }
  .nfc-panel { width: 69mm; height: 55mm; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 4mm; background: #8f1d27; color: white; padding: 3mm; }
  .nfc-heading { font-size: 4.5mm; font-weight: 900; letter-spacing: 0.3mm; }
  .nfc-heading strong { color: #f2d4d0; }
  .nfc-illustration { width: 50mm; height: 38mm; margin: 1mm 0; }
  .nfc-illustration .phone { fill: none; stroke: white; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .nfc-illustration .radio-waves { fill: none; stroke: #f2d4d0; stroke-width: 5; stroke-linecap: round; }
  .nfc-illustration .radio-dot { fill: #f2d4d0; }
  .nfc-illustration .tap-target { fill: none; stroke: #f2d4d0; stroke-width: 3; }
  .nfc-illustration .tap-dot { fill: #f2d4d0; stroke: none; }
  .footer { position: absolute; right: 0; bottom: 0; left: 0; height: 15mm; display: flex; align-items: center; justify-content: space-between; padding: 2mm 8mm; border-top: 1mm solid #c62832; background: #8f1d27; color: white; }
  .powered { display: grid; grid-template-columns: 7mm auto; grid-template-rows: auto auto; column-gap: 1mm; align-items: center; }
  .globe { grid-row: span 2; font-size: 6mm; }
  .powered small { font-size: 2mm; }
  .powered strong { font-size: 4mm; }
  .tagline { font-size: 3.2mm; font-style: italic; font-weight: 700; }
  .company { font-size: 2.7mm; }
  .company strong { color: #f2d4d0; }
  @page { size: A4 portrait; margin: 0; }
</style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

export default function QrTab() {
  const [tables, setTables] = useState([]);
  const [qrTokens, setQrTokens] = useState({});
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [copiedTable, setCopiedTable] = useState(null);

  useEffect(() => {
    Promise.all([fetchTables(), fetchServerInfo(), fetchTableQrTokens()])
      .then(([t, i, qr]) => {
        setTables(t);
        setInfo(i);
        setQrTokens(Object.fromEntries(qr.map(({ tableNo, token }) => [tableNo, token])));
      })
      .catch((e) => setError(e.message));
  }, []);

  const base = useMemo(() => pickBaseUrl(info), [info]);
  const baseIsLocal = useMemo(() => {
    try { return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(new URL(base).hostname); }
    catch { return true; }
  }, [base]);
  const copyNfcLink = async (url, table) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        try {
          input.select();
          if (!document.execCommand('copy')) throw new Error('clipboard access is unavailable.');
        } finally {
          input.remove();
        }
      }
      setCopiedTable(table);
      setError('');
    } catch (e) {
      setError(`Could not copy the NFC link: ${e.message || 'clipboard access is unavailable.'}`);
    }
  };

  // Render each QR to a PNG data URL, then hand a clean, self-contained document
  // to a new window for printing (one table per page).
  const printAll = async () => {
    if (printing || !tables.length) return;
    setPrinting(true);
    setError('');
    try {
      const cards = await Promise.all(
        tables.map(async (t) => ({
          table: t,
          dataUrl: await QRCode.toDataURL(tableUrl(base, t, qrTokens[t]), {
            width: 600, margin: 2, color: { dark: '#4a3728' },
          }),
        }))
      );
      const logoResponse = await fetch(`${window.location.origin}${CAFE_LOGO}`);
      if (!logoResponse.ok) throw new Error('Could not load the Tavrix logo for printing.');
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read the Tavrix logo.'));
        reader.readAsDataURL(logoBlob);
      });
      const w = window.open('', '_blank');
      if (!w) {
        setError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
        return;
      }
      w.document.open();
      w.document.write(buildPrintHtml(cards, logoDataUrl));
      w.document.close();
      // Drive printing from the opener. The print window is an about:blank
      // document that inherits this app's CSP (script-src 'self'), so an inline
      // onload/script inside it would be blocked — calling w.print() from here
      // isn't. Small delay lets the data-URL images lay out before the dialog.
      w.focus();
      const doPrint = () => { try { w.print(); } catch { /* user closed it */ } };
      if (w.document.readyState === 'complete') setTimeout(doPrint, 300);
      else w.addEventListener('load', () => setTimeout(doPrint, 150));
    } catch (e) {
      setError(e.message || 'Could not prepare the QR codes for printing.');
    } finally {
      setPrinting(false);
    }
  };

  if (error && !info) return <p className="text-red-500 font-bold">{error}</p>;
  if (!info) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-espresso" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-espresso/10 bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-chiya">
            <Printer size={15} /> Table setup
          </div>
          <h2 className="text-2xl font-black tracking-tight text-bean sm:text-3xl">Table QR Codes</h2>
          <p className="mt-1 text-sm text-bean/55">
            Codes point to <span className="font-mono font-bold break-all">{base || '—'}</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-bean/55">
            Each card prints at 150 × 100 mm, with two cards per A4 sheet. Print on A4 portrait at actual size (100%).
          </p>
        </div>
        <button
          onClick={printAll}
          disabled={printing || !tables.length}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-chiya px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {printing ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
          Print All
        </button>
      </div>

      {baseIsLocal && (
        <div className="flex items-start gap-2 mb-5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>
            These codes currently point to <span className="font-mono">localhost</span>, which a customer's phone
            can't reach. Open this dashboard using the café's public web address (or the shop's LAN IP like{' '}
            <span className="font-mono">{info.baseUrl}</span>) and the codes will update automatically before you print.
          </span>
        </div>
      )}

      {error && <p className="text-red-500 text-sm font-bold mb-4">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tables.map((t) => (
          <TableQr
            key={t}
            table={t}
            url={tableUrl(base, t, qrTokens[t])}
            urlBytes={new TextEncoder().encode(tableUrl(base, t, qrTokens[t])).length}
            onCopy={copyNfcLink}
            copied={copiedTable === t}
          />
        ))}
      </div>
    </div>
  );
}
