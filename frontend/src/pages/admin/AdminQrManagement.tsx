// ============================================================================
// File: frontend/src/pages/admin/AdminQrManagement.tsx
// Description: Multi-location QR code generator and printable table stand preview
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Printer,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRestaurant } from '../../context/RestaurantContext.js';
import { api } from '../../services/api.js';
import type { QrCodeItem } from '../../types/index.js';
import { Modal } from '../../components/common/Modal.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton } from '../../components/common/Skeleton.js';

export const AdminQrManagement: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [qrCodes, setQrCodes] = useState<QrCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [locationTag, setLocationTag] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Printable Stand Preview
  const [previewQr, setPreviewQr] = useState<{ label: string; url: string } | null>(null);

  const fetchQrCodes = async () => {
    if (!restaurant) return;
    try {
      setIsLoading(true);
      const data = await api.admin.getQrCodes(restaurant.id);
      setQrCodes(data || []);
    } catch (err) {
      console.error('Failed to load QR codes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQrCodes();
  }, [restaurant]);

  const handleOpenCreate = () => {
    const defaultTag = `table-${(qrCodes.length + 1).toString().padStart(2, '0')}`;
    setLabel(`Table #${qrCodes.length + 1}`);
    setIdentifier(`${restaurant?.slug || 'store'}-${defaultTag}`);
    setLocationTag(defaultTag);
    setTargetPath(`/r/${restaurant?.slug || 'artisan-coffee'}?table=${qrCodes.length + 1}`);
    setError(null);
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await api.admin.createQrCode(restaurant.id, {
        label: label.trim(),
        code_identifier: identifier.trim().toLowerCase(),
        location_tag: locationTag.trim() || undefined,
        target_path: targetPath.trim(),
      });
      setIsCreateOpen(false);
      fetchQrCodes();
    } catch (err: any) {
      console.error('Failed to create QR code:', err);
      setError(err.message || 'Failed to create QR code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const defaultQrUrl = `${currentOrigin}/r/${restaurant?.slug || 'artisan-coffee'}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 text-brand-400" />
            <span>QR Code & Table Stand Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate location-specific QR codes, track customer scans, and print physical display cards.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              setPreviewQr({
                label: 'Main Counter Stand',
                url: defaultQrUrl,
              })
            }
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4 text-brand-400" />
            <span>Print Display Stand</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Table QR</span>
          </button>
        </div>
      </div>

      {/* Primary Landing QR Card Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-200 shrink-0">
            <QRCodeSVG value={defaultQrUrl} size={110} level="H" includeMargin={false} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">
              Primary Storefront Landing QR
            </span>
            <h3 className="text-lg font-bold text-white">Main Loyalty Onboarding URL</h3>
            <p className="text-xs text-slate-400 font-mono break-all">{defaultQrUrl}</p>
            <p className="text-xs text-slate-400 pt-1">
              Use this QR code on menus, receipts, table tents, and at your ordering counter.
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(defaultQrUrl);
              alert('Copied QR URL to clipboard!');
            }}
            leftIcon={<Copy className="w-4 h-4" />}
          >
            Copy URL
          </Button>
          <Button
            variant="primary"
            onClick={() => setPreviewQr({ label: 'Main Loyalty QR', url: defaultQrUrl })}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Preview Printable Stand
          </Button>
        </div>
      </div>

      {/* Locations QR Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Configured Location QR Codes
        </h3>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
              <Skeleton className="w-full h-10 rounded-xl bg-slate-700" />
            </div>
          ) : qrCodes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-700/80">
                  <tr>
                    <th className="py-3.5 px-4">Label</th>
                    <th className="py-3.5 px-4">Identifier</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Target Path</th>
                    <th className="py-3.5 px-4 text-center">Scan Count</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {qrCodes.map((code) => {
                    const fullUrl = `${currentOrigin}${code.target_path}`;
                    return (
                      <tr key={code.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                          <QrCode className="w-4 h-4 text-brand-400" />
                          <span>{code.label}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          {code.code_identifier}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {code.location_tag || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] max-w-xs truncate">
                          {code.target_path}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-brand-400 font-mono">
                          {code.scan_count}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => setPreviewQr({ label: code.label, url: fullUrl })}
                            className="p-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                            title="Print Card"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No custom table QR codes created yet. Create table codes to track scan locations.
            </div>
          )}
        </div>
      </div>

      {/* Create QR Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Table / Location QR"
        maxWidth="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Label *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Table #12, Patio Booth 3"
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Code Identifier *
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. artisan-table-12"
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Location Tag
            </label>
            <input
              type="text"
              value={locationTag}
              onChange={(e) => setLocationTag(e.target.value)}
              placeholder="e.g. table-12, counter, patio"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Path *
            </label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/r/artisan-coffee?table=12"
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSubmitting}
            >
              Generate QR Code
            </Button>
          </div>
        </form>
      </Modal>

      {/* Printable Display Stand Preview Modal */}
      <Modal
        isOpen={!!previewQr}
        onClose={() => setPreviewQr(null)}
        title="Printable Table Stand Preview"
        maxWidth="sm"
      >
        {previewQr && (
          <div className="space-y-4">
            {/* Branded Card Display Preview */}
            <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xl text-center space-y-4">
              <div
                className="py-3 px-4 rounded-2xl text-white font-extrabold text-base shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${restaurant?.brand_color || '#d97706'} 0%, ${
                    restaurant?.accent_color || '#b45309'
                  } 100%)`,
                }}
              >
                {restaurant?.name}
              </div>

              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Scan to Earn Rewards!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Collect loyalty points or stamps on every order and claim free perks.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 inline-block shadow-inner">
                <QRCodeSVG value={previewQr.url} size={180} level="H" includeMargin={true} />
              </div>

              <div className="flex items-center justify-center gap-3 text-[11px] text-slate-600 font-semibold pt-1">
                <span>1. Scan QR</span>
                <span>•</span>
                <span>2. Order & Earn</span>
                <span>•</span>
                <span>3. Get Free Rewards</span>
              </div>

              <div className="text-[10px] text-slate-400 font-mono">
                {previewQr.label} • No App Download Required
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setPreviewQr(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Stand Card
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
