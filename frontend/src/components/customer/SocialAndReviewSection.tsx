import React from 'react';
import { ExternalLink, Globe, MessageSquare, Heart } from 'lucide-react';
import type { Restaurant, RestaurantSettings } from '../../types/index.js';

interface SocialAndReviewSectionProps {
  restaurant: Restaurant;
  settings?: RestaurantSettings | null;
}

export const SocialAndReviewSection: React.FC<SocialAndReviewSectionProps> = ({
  restaurant,
  settings,
}) => {
  const isSaDosaCafe =
    restaurant.slug === 'sa-dosa-cafe' ||
    restaurant.name.toLowerCase().includes('dosa');

  // Dynamic URLs from restaurant settings with brand-specific fallbacks
  const instagramUrl =
    settings?.instagram_url ||
    (isSaDosaCafe ? 'https://www.instagram.com/sa_dosacafe/' : null);

  const facebookUrl =
    settings?.facebook_url ||
    (isSaDosaCafe ? 'https://www.facebook.com/sadosacafe/' : null);

  const websiteUrl =
    settings?.website_url ||
    (isSaDosaCafe ? 'https://sadosacafe.com/' : null);

  const googleReviewUrl =
    settings?.google_review_url ||
    (isSaDosaCafe ? 'https://sadosacafe.com/' : null);

  return (
    <section className="space-y-4 pt-2">
      {/* 1. SOCIAL MEDIA SECTION */}
      <div className="bg-white rounded-3xl p-5 border border-amber-200/60 shadow-xs space-y-3.5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-[#FF6310] text-white shadow-xs">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Stay Connected With {isSaDosaCafe ? 'SA Dosa Cafe' : restaurant.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Follow us for new dishes, offers, cafe updates and more.
            </p>
          </div>
        </div>

        {/* Social Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 hover:from-pink-500/15 hover:to-rose-500/15 border border-pink-200/70 text-slate-800 text-xs font-bold transition-all active:scale-95 group"
            >
              <svg className="w-4 h-4 text-pink-600 fill-current group-hover:scale-110 transition-transform shrink-0" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span>@sa_dosacafe</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
            </a>
          )}

          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-200/70 text-slate-800 text-xs font-bold transition-all active:scale-95 group"
            >
              <svg className="w-4 h-4 text-blue-600 fill-current group-hover:scale-110 transition-transform shrink-0" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
            </a>
          )}
        </div>

        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-600 text-xs font-semibold transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Visit Official Website: sadosacafe.com</span>
            <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
          </a>
        )}
      </div>

      {/* 2. OPTIONAL GOOGLE REVIEW SECTION */}
      {googleReviewUrl && (
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 rounded-3xl p-5 border border-amber-300/60 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-xs border border-amber-200">
              {/* Google stylized G mark */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Enjoyed Your Visit?
              </span>
              <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                Tell us about your experience
              </h4>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Your honest feedback helps us serve crispy dosas and comforting filter coffee even better.
          </p>

          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 group cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-[#FF6310]" />
            <span>Leave a Google Review</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
          </a>

          <span className="block text-center text-[10px] text-slate-400 italic">
            Reviews are optional and independent of loyalty points & rewards.
          </span>
        </div>
      )}
    </section>
  );
};
