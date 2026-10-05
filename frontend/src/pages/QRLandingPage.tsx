// ============================================================================
// File: frontend/src/pages/QRLandingPage.tsx
// Description: Scanned QR code landing page supporting SA Dosa Cafe and generic tenants
// ============================================================================

import React, { useState } from 'react';
import { Sparkles, Coffee, ArrowRight, ShieldCheck, Star, Gift } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/common/Button.js';
import { LoginModal } from '../components/auth/LoginModal.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { SaDosaCafeLogo } from '../components/common/SaDosaCafeLogo.js';

interface QRLandingPageProps {
  onAuthenticated: () => void;
}

export const QRLandingPage: React.FC<QRLandingPageProps> = ({ onAuthenticated }) => {
  const { restaurant, settings, isLoading, error } = useRestaurant();
  const { isAuthenticated } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 p-6 space-y-6">
        <Skeleton className="w-full h-48 rounded-3xl" />
        <Skeleton className="w-3/4 h-8 mx-auto" />
        <Skeleton className="w-full h-32 rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="w-full h-20 rounded-2xl" />
          <Skeleton className="w-full h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <Coffee className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Restaurant Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">
          {error || 'The QR code you scanned does not correspond to an active restaurant.'}
        </p>
      </div>
    );
  }

  const isSaDosaCafe =
    restaurant.slug === 'sa-dosa-cafe' ||
    restaurant.name.toLowerCase().includes('dosa');

  const isStamps = settings?.loyalty_model === 'STAMPS';
  const stampsTarget = settings?.stamps_target_count || 7;
  const welcomeBonus = isStamps ? settings?.welcome_bonus_stamps : settings?.welcome_bonus_points;

  // Curated specialties for S A Dosa Cafe visual showcase
  const specialties = [
    { name: 'Mysore Masala Dosa', tag: 'Crispy & Spicy', desc: 'Red chutney spread with potato masala' },
    { name: 'Cheese Schezwan Dosa', tag: 'Cafe Fusion', desc: 'Gooey cheese with zesty Schezwan kick' },
    { name: 'Paneer Butter Dosa', tag: 'Chef Special', desc: 'Rich malai paneer in aromatic spices' },
    { name: 'Filter Kaapi & Cold Brew', tag: 'South Indian Classic', desc: 'Authentic frothy traditional coffee' },
  ];

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-36 text-slate-800">
      {/* Top Hero Header with Brand Aesthetics */}
      <div
        className="relative px-6 pt-10 pb-16 text-white text-center rounded-b-[2.5rem] shadow-xl overflow-hidden"
        style={{
          background: isSaDosaCafe
            ? 'linear-gradient(145deg, #FF6310 0%, #E05307 45%, #9A3412 100%)'
            : `linear-gradient(135deg, ${restaurant.brand_color || '#d97706'} 0%, ${
                restaurant.accent_color || '#b45309'
              } 100%)`,
        }}
      >
        {/* Glow watermarks */}
        <div className="absolute -top-12 -right-12 w-52 h-52 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-44 h-44 bg-black/15 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Brand Logo & Heading */}
          {isSaDosaCafe ? (
            <>
              <div className="mb-3">
                <SaDosaCafeLogo size="hero" variant="full" inverted={true} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm mt-1">
                Welcome to SA Dosa Cafe
              </h1>
            </>
          ) : (
            <>
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-20 h-20 rounded-2xl object-cover shadow-md bg-white p-1 mb-3"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-sm">
                  <Coffee className="w-8 h-8 text-white" />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
                {restaurant.name}
              </h1>
            </>
          )}

          <p className="text-sm text-amber-100 font-semibold mt-1 max-w-xs">
            {restaurant.tagline || (isSaDosaCafe ? 'Eat. Collect. Enjoy.' : 'Earn points & redeem exclusive rewards')}
          </p>

          <div className="mt-3.5 flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-50 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>Official Customer Loyalty Club</span>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-8 space-y-4 relative z-20">
        {/* Welcome Bonus Card (for points/stamps programs with welcome bonus) */}
        {!isSaDosaCafe && welcomeBonus && welcomeBonus > 0 ? (
          <div className="bg-white rounded-3xl p-4 shadow-md border border-slate-100 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                Welcome Gift
              </span>
              <p className="text-sm font-bold text-slate-800">
                Get {welcomeBonus} {isStamps ? 'free stamps' : 'bonus points'} instantly!
              </p>
              <p className="text-xs text-slate-500">
                Credited automatically to your digital card upon joining.
              </p>
            </div>
          </div>
        ) : null}

        {/* Central 7-Stamp Benefit Card (for SA Dosa Cafe) */}
        {isSaDosaCafe && (
          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-orange-950/5 border border-amber-200/60 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF6310]">
                Simple Loyalty Progress
              </span>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                Collect 7 stamps and enjoy a FREE reward
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                7 visits = a signature reward on us 🎉
              </p>
            </div>

            {/* Visual Seven-Stamp Progress Concept: ○ ○ ○ ○ ○ ○ ○ */}
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                {Array.from({ length: stampsTarget }).map((_, index) => {
                  const isFinal = index === stampsTarget - 1;
                  return (
                    <div
                      key={index}
                      className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                        isFinal
                          ? 'border-2 border-amber-400 bg-amber-100 text-amber-800 shadow-2xs'
                          : 'border-2 border-dashed border-amber-300 bg-white text-amber-700'
                      }`}
                    >
                      {isFinal ? (
                        <Star className="w-4 h-4 text-[#FF6310] fill-amber-400" />
                      ) : (
                        <span>○</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-amber-800 mt-2.5 px-0.5">
                <span>Visit 1</span>
                <span>Visit 4</span>
                <span className="text-[#FF6310]">Reward unlocked! ⭐</span>
              </div>
            </div>

            {/* Value Prop Highlights */}
            <div className="grid grid-cols-2 gap-2 text-center pt-1 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="block font-black text-[#FF6310]">No Plastic Cards</span>
                <span className="text-[10px] text-slate-500 font-medium">Live on your phone</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="block font-black text-emerald-600">Free to Join</span>
                <span className="text-[10px] text-slate-500 font-medium">Mobile OTP login</span>
              </div>
            </div>
          </div>
        )}

        {/* How it Works Card (for generic tenants) */}
        {!isSaDosaCafe && (
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              How It Works
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <p className="text-slate-600 pt-0.5">
                  <strong>Scan & Order:</strong> Show your member QR code to your cashier or server during your visit.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <p className="text-slate-600 pt-0.5">
                  {isStamps ? (
                    <>
                      <strong>Collect Stamps:</strong> Earn 1 stamp with each qualifying visit.
                    </>
                  ) : (
                    <>
                      <strong>Earn Points:</strong> Earn {settings?.points_per_currency_unit || 10} points for every $1 you spend.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <p className="text-slate-600 pt-0.5">
                  <strong>Unlock Rewards:</strong> Redeem coffees, artisan pastries, appetizers, and special surprises.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Featured Cafe Specialties Preview (SA Dosa Cafe) */}
        {isSaDosaCafe && (
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Cafe Favorites to Try
              </h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                75+ Dosa Varieties
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {specialties.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border border-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6310] flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{item.desc}</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded-lg whitespace-nowrap">
                    {item.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security / Privacy assurance */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 py-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Instant mobile OTP. Zero spam guaranteed.</span>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 p-4 shadow-2xl z-40 max-w-md mx-auto space-y-2">
        {isAuthenticated ? (
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={onAuthenticated}
            className="bg-[#FF6310] hover:bg-[#E05307] py-3.5 text-base font-black shadow-md shadow-orange-500/25"
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            OPEN MY LOYALTY CARD
          </Button>
        ) : isSaDosaCafe ? (
          <div className="space-y-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => setIsLoginOpen(true)}
              className="bg-[#FF6310] hover:bg-[#E05307] py-3.5 text-base font-black shadow-md shadow-orange-500/25"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Join the Loyalty Club
            </Button>

            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1 cursor-pointer"
            >
              Already a member? <span className="text-[#FF6310] underline">Sign in</span>
            </button>
          </div>
        ) : (
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => setIsLoginOpen(true)}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Join or Log In
          </Button>
        )}
      </div>

      {/* Login / OTP Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={onAuthenticated}
      />
    </div>
  );
};
