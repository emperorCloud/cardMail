import { Download, Share, WifiOff } from 'lucide-react';
import React, { useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.ts';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { Button, Dialog, DialogContent } from '../ui/primitives.tsx';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void install()}
        title="Installer CARDMail sur cet appareil"
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
        {!compact && <span>Installer l'app</span>}
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          title="Installer sur iPhone / iPad"
          className="gap-1.5"
        >
          <Share className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          {!compact && <span>Installer iOS</span>}
        </Button>

        <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
          <DialogContent
            title="Installer CARDMail sur iOS"
            description="Ajoutez CARDMail à votre écran d'accueil iPhone ou iPad pour un accès en mode application autonome."
            className="max-w-sm"
          >
            <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <li>
                1. Touchez le bouton <strong>Partager</strong> dans la barre de Safari.
              </li>
              <li>
                2. Faites défiler vers le bas et sélectionnez <strong>Sur l'écran d'accueil</strong>.
              </li>
              <li>
                3. Confirmez en appuyant sur <strong>Ajouter</strong>.
              </li>
            </ol>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowIOSGuide(false)}>
                Compris
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-md md:bottom-4 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      <span>Hors connexion — Les nouveaux messages seront synchronisés au retour du réseau.</span>
    </div>
  );
};
