import React from 'react';

export default function StorageLimitModal({ onEnableSync }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-700 overflow-hidden">
        {/* Content */}
        <div className="p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">💾</div>
            <h2 className="text-3xl font-bold text-white mb-2">Browser Storage Limit Reached</h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Your browser has a storage limit, and you've filled it up with your amazing sessions and diagrams! Good news — there's a simple solution.
            </p>

            {/* Explanation */}
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 mb-6 text-left">
              <p className="text-slate-200 text-sm leading-relaxed">
                <strong className="text-blue-300">Enable Cloud Sync</strong> to sync your data with our servers. This removes the storage limit and unlocks powerful sharing features — all completely free.
              </p>
            </div>

            {/* What Cloud Sync provides */}
            <div className="bg-slate-700/40 rounded-xl p-4 mb-6 text-left space-y-3">
              <div className="flex gap-3 items-start">
                <span className="text-lg">📱</span>
                <div>
                  <h3 className="font-semibold text-white text-sm">Access on All Your Devices</h3>
                  <p className="text-slate-400 text-xs">Start planning on your phone, finish on your tablet. Your sessions are always in sync.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-lg">👥</span>
                <div>
                  <h3 className="font-semibold text-white text-sm">Share with Other Coaches</h3>
                  <p className="text-slate-400 text-xs">Generate share codes to let other coaches view or collaborate on sessions in real-time.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-lg">🔒</span>
                <div>
                  <h3 className="font-semibold text-white text-sm">No Account Needed</h3>
                  <p className="text-slate-400 text-xs">Just a simple device pairing code. No email, password, or personal info required.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-lg">✨</span>
                <div>
                  <h3 className="font-semibold text-white text-sm">Unlimited Storage</h3>
                  <p className="text-slate-400 text-xs">Create as many sessions, drills, and diagrams as you want.</p>
                </div>
              </div>
            </div>

            <p className="text-slate-500 text-sm">
              Cloud Sync is <strong className="text-green-400">completely free</strong> with no strings attached.
            </p>
          </div>
        </div>

        {/* Footer with action button */}
        <div className="px-8 pb-6 border-t border-slate-700">
          <button
            onClick={onEnableSync}
            className="w-full btn btn-primary text-lg py-3 font-semibold"
          >
            Enable Cloud Sync
          </button>
          <p className="text-slate-500 text-xs text-center mt-3">
            Takes less than 1 minute. You'll get a pairing code to use on your other devices.
          </p>
        </div>
      </div>
    </div>
  );
}
