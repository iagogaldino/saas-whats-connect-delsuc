import QRCode from 'react-qr-code';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchWhatsAppProfilePhotoForInstance,
  fetchListeningStatusForInstance,
  fetchHealth,
  logoutWhatsAppForInstance,
  updateWhatsAppProfilePhotoForInstance,
  fetchWhatsAppQrForInstance,
  fetchWhatsAppStatusForInstance,
  sendCode,
  startListeningMessagesForInstance,
  stopListeningMessagesForInstance,
  startWhatsAppPairingForInstance,
  fetchWebhookConfigForInstance,
  putWebhookConfigForInstance,
  postWebhookTestForInstance,
} from '../../lib/api';
import { validateCode, validatePhone } from '../../lib/validation';
import { Icon } from './Icon';

function formatSyncTime(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PROFILE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type DashboardHomeProps = {
  instanceId: string;
  instanceName: string;
  instanceCode: string;
};

export function DashboardHome({ instanceId, instanceName, instanceCode }: DashboardHomeProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [whatsappReady, setWhatsappReady] = useState<boolean | null>(null);
  const [pairingPending, setPairingPending] = useState(false);
  /** Usuário clicou em "Gerar QR" nesta sessão do navegador (pareamento em curso). */
  const [pairingFlowActive, setPairingFlowActive] = useState(false);
  /** True do clique até o QR existir na API ou sessão falhar / conectar. */
  const [waitingForQr, setWaitingForQr] = useState(false);
  const [pairingRequestLoading, setPairingRequestLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [listeningEnabled, setListeningEnabled] = useState(false);
  const [listeningClients, setListeningClients] = useState(0);
  const [listeningLoading, setListeningLoading] = useState(false);
  const [listeningError, setListeningError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSecretLast4, setWebhookSecretLast4] = useState<string | null>(null);
  const [webhookHasSecret, setWebhookHasSecret] = useState(false);
  const [webhookRevealedSecret, setWebhookRevealedSecret] = useState<string | null>(null);
  const [webhookLoadError, setWebhookLoadError] = useState<string | null>(null);
  const [webhookSaveLoading, setWebhookSaveLoading] = useState(false);
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>('—');

  const [responseLog, setResponseLog] = useState<string>(
    '{\n  "info": "Nenhuma requisição ainda."\n}'
  );
  const [sendLoading, setSendLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const [profilePhotoSuccess, setProfilePhotoSuccess] = useState<string | null>(null);
  const [profilePhotoLoading, setProfilePhotoLoading] = useState(false);
  const [currentProfilePhotoUrl, setCurrentProfilePhotoUrl] = useState<string | null>(null);
  const [currentPhotoLoading, setCurrentPhotoLoading] = useState(false);

  const digitsPhone = phone.replace(/\D/g, '');
  const codeTrimmed = code.trim();
  const codeValid = codeTrimmed.length >= 1 && codeTrimmed.length <= 200;

  useEffect(() => {
    if (!profilePhotoFile) {
      setProfilePhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(profilePhotoFile);
    setProfilePhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profilePhotoFile]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      await fetchHealth();
      setApiOnline(true);
      setLastSync(formatSyncTime());
    } catch (e) {
      setApiOnline(false);
      setHealthError(e instanceof Error ? e.message : 'Falha na rede');
      setLastSync(formatSyncTime());
    } finally {
      setHealthLoading(false);
    }
  }, [instanceId]);

  const loadWhatsAppStatus = useCallback(async () => {
    try {
      const data = await fetchWhatsAppStatusForInstance(instanceId);
      setWhatsappReady(data.whatsappReady);
      setPairingPending(data.pairingPending);
      if (data.whatsappReady) {
        setQrPayload(null);
        setPairingFlowActive(false);
        setWaitingForQr(false);
      } else if (!data.pairingPending) {
        setPairingFlowActive(false);
        setWaitingForQr(false);
      }
      setLastSync(formatSyncTime());
    } catch {
      setWhatsappReady(null);
      setPairingPending(false);
      setPairingFlowActive(false);
      setWaitingForQr(false);
    }
  }, [instanceId]);

  const loadListeningStatus = useCallback(async () => {
    setListeningError(null);
    try {
      const data = await fetchListeningStatusForInstance(instanceId);
      setListeningEnabled(data.enabled);
      setListeningClients(data.connectedClients);
    } catch (e) {
      setListeningError(e instanceof Error ? e.message : 'Falha ao consultar canal');
    }
  }, [instanceId]);

  const loadWebhookConfig = useCallback(async () => {
    setWebhookLoadError(null);
    try {
      const data = await fetchWebhookConfigForInstance(instanceId);
      setWebhookUrl(data.url ?? '');
      setWebhookEnabled(data.enabled);
      setWebhookSecretLast4(data.secretLast4);
      setWebhookHasSecret(data.hasSecret);
    } catch (e) {
      setWebhookLoadError(e instanceof Error ? e.message : 'Falha ao carregar webhook');
    }
  }, [instanceId]);

  const loadCurrentProfilePhoto = useCallback(async () => {
    if (whatsappReady !== true) {
      setCurrentProfilePhotoUrl(null);
      return;
    }
    setCurrentPhotoLoading(true);
    try {
      const data = await fetchWhatsAppProfilePhotoForInstance(instanceId);
      setCurrentProfilePhotoUrl(data.url);
    } catch {
      setCurrentProfilePhotoUrl(null);
    } finally {
      setCurrentPhotoLoading(false);
    }
  }, [instanceId, whatsappReady]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    void loadWhatsAppStatus();
  }, [loadWhatsAppStatus]);

  useEffect(() => {
    void loadListeningStatus();
  }, [loadListeningStatus]);

  useEffect(() => {
    void loadWebhookConfig();
  }, [loadWebhookConfig]);

  useEffect(() => {
    const onRefresh = () => {
      void loadHealth();
      void loadWhatsAppStatus();
      void loadListeningStatus();
      void loadWebhookConfig();
    };
    window.addEventListener('otp-monitor:refresh-health', onRefresh);
    return () => window.removeEventListener('otp-monitor:refresh-health', onRefresh);
  }, [loadHealth, loadWhatsAppStatus, loadListeningStatus, loadWebhookConfig]);

  useEffect(() => {
    if (apiOnline !== true) return;
    void loadWhatsAppStatus();
  }, [apiOnline, loadWhatsAppStatus]);

  useEffect(() => {
    void loadCurrentProfilePhoto();
  }, [loadCurrentProfilePhoto]);

  const loadQr = useCallback(async () => {
    try {
      const { qr } = await fetchWhatsAppQrForInstance(instanceId);
      setQrPayload(qr);
    } catch {
      setQrPayload(null);
    }
  }, [instanceId]);

  const pairingPoll =
    apiOnline === true &&
    whatsappReady === false &&
    (pairingPending || pairingFlowActive);

  useEffect(() => {
    if (!pairingPoll) return;
    void loadQr();
    void loadWhatsAppStatus();
    const id = window.setInterval(() => {
      void loadQr();
      void loadWhatsAppStatus();
    }, 2000);
    return () => window.clearInterval(id);
  }, [pairingPoll, loadQr, loadWhatsAppStatus]);

  async function handleStartPairing() {
    setPairingRequestLoading(true);
    setWaitingForQr(true);
    setPairingFlowActive(true);
    try {
      await startWhatsAppPairingForInstance(instanceId);
      await loadWhatsAppStatus();
      await loadQr();
    } catch {
      setPairingFlowActive(false);
      setWaitingForQr(false);
    } finally {
      setPairingRequestLoading(false);
    }
  }

  async function handleDisconnectWhatsApp() {
    setDisconnectLoading(true);
    try {
      await logoutWhatsAppForInstance(instanceId);
      setQrPayload(null);
      setPairingFlowActive(false);
      setWaitingForQr(false);
      await loadWhatsAppStatus();
    } catch (err) {
      const e = err as Error & { status?: number; details?: unknown };
      setResponseLog(
        JSON.stringify(
          {
            ok: false,
            status: e.status ?? 'unknown',
            error: e.message,
            details: e.details,
          },
          null,
          2
        )
      );
    } finally {
      setDisconnectLoading(false);
    }
  }

  async function handleToggleListening() {
    setListeningLoading(true);
    setListeningError(null);
    try {
      const data = listeningEnabled
        ? await stopListeningMessagesForInstance(instanceId)
        : await startListeningMessagesForInstance(instanceId);
      setListeningEnabled(data.enabled);
      setListeningClients(data.connectedClients);
      void loadWebhookConfig();
    } catch (e) {
      setListeningError(e instanceof Error ? e.message : 'Falha ao alterar estado do canal');
    } finally {
      setListeningLoading(false);
    }
  }

  function handleProfilePhotoSelected(file: File | null) {
    setProfilePhotoError(null);
    setProfilePhotoSuccess(null);
    if (!file) {
      setProfilePhotoFile(null);
      return;
    }
    if (!ALLOWED_PROFILE_MIME_TYPES.has(file.type)) {
      setProfilePhotoError('Formato inválido. Use JPG, PNG ou WEBP.');
      setProfilePhotoFile(null);
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setProfilePhotoError('Arquivo muito grande. Máximo permitido: 2MB.');
      setProfilePhotoFile(null);
      return;
    }
    setProfilePhotoFile(file);
  }

  async function handleUpdateProfilePhoto() {
    if (!profilePhotoFile) {
      setProfilePhotoError('Selecione uma imagem antes de enviar.');
      return;
    }
    setProfilePhotoLoading(true);
    setProfilePhotoError(null);
    setProfilePhotoSuccess(null);
    try {
      await updateWhatsAppProfilePhotoForInstance(instanceId, profilePhotoFile);
      setProfilePhotoSuccess('Foto de perfil atualizada com sucesso.');
      setProfilePhotoFile(null);
      await loadCurrentProfilePhoto();
    } catch (err) {
      const e = err as Error;
      setProfilePhotoError(e.message || 'Falha ao atualizar foto de perfil.');
    } finally {
      setProfilePhotoLoading(false);
    }
  }

  async function handleSaveWebhook(regenerateSecret: boolean) {
    setWebhookSaveLoading(true);
    setWebhookLoadError(null);
    try {
      const res = await putWebhookConfigForInstance(instanceId, {
        url: webhookUrl.trim(),
        enabled: webhookEnabled,
        regenerateSecret,
      });
      setWebhookUrl(res.config.url ?? '');
      setWebhookEnabled(res.config.enabled);
      setWebhookSecretLast4(res.config.secretLast4);
      setWebhookHasSecret(res.config.hasSecret);
      if (res.secret) {
        setWebhookRevealedSecret(res.secret);
      }
      if (res.config.enabled) {
        void loadListeningStatus();
      }
    } catch (e) {
      setWebhookLoadError(e instanceof Error ? e.message : 'Falha ao guardar');
    } finally {
      setWebhookSaveLoading(false);
    }
  }

  async function handleTestWebhook() {
    setWebhookTestLoading(true);
    setWebhookLoadError(null);
    try {
      const res = await postWebhookTestForInstance(instanceId);
      setResponseLog(
        JSON.stringify(
          { ok: res.ok, status: res.status, info: 'Resposta do servidor ao testar o webhook' },
          null,
          2
        )
      );
    } catch (e) {
      setWebhookLoadError(e instanceof Error ? e.message : 'Falha no teste');
    } finally {
      setWebhookTestLoading(false);
    }
  }

  useEffect(() => {
    if (qrPayload && waitingForQr) {
      setWaitingForQr(false);
    }
  }, [qrPayload, waitingForQr]);

  useEffect(() => {
    if (whatsappReady && waitingForQr) {
      setWaitingForQr(false);
    }
  }, [whatsappReady, waitingForQr]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const errPhone = validatePhone(digitsPhone);
    const errCode = validateCode(code);
    if (errPhone || errCode) {
      setResponseLog(
        JSON.stringify(
          { error: 'validation', messages: [errPhone, errCode].filter(Boolean) },
          null,
          2
        )
      );
      return;
    }

    setSendLoading(true);
    try {
      const res = await sendCode(instanceId, { phoneNumber: digitsPhone, message: codeTrimmed });
      setResponseLog(JSON.stringify({ ok: true, status: 200, body: res }, null, 2));
    } catch (err) {
      const e = err as Error & { status?: number; details?: unknown };
      setResponseLog(
        JSON.stringify(
          {
            ok: false,
            status: e.status ?? 'unknown',
            error: e.message,
            details: e.details,
          },
          null,
          2
        )
      );
    } finally {
      setSendLoading(false);
    }
  }

  function handleCopyJson() {
    void navigator.clipboard.writeText(responseLog);
  }

  function handleClearForm() {
    setPhone('');
    setCode('');
  }

  const showConnectCta =
    apiOnline === true && whatsappReady === false && !pairingPending && !pairingFlowActive;
  const showAutoReconnect =
    apiOnline === true &&
    whatsappReady === false &&
    pairingPending &&
    !pairingFlowActive &&
    !qrPayload;
  const showPairingQr =
    apiOnline === true && whatsappReady === false && (pairingPending || pairingFlowActive);

  return (
    <div id="dashboard-main" className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between border-b border-outline-variant/10 pb-4">
        <div>
          <h1 className="text-on-surface text-2xl font-bold tracking-tight">{instanceName}</h1>
          <p className="text-outline mt-1 text-sm">
            Instancia <code className="text-xs">{instanceCode}</code> - gerencie envios de mensagens via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/instances/${instanceId}/history`}
            className="border-outline-variant text-outline hover:bg-surface-container-high rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
          >
            History
          </Link>
          <Link
            to={`/instances/${instanceId}/logs`}
            className="border-outline-variant text-outline hover:bg-surface-container-high rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
          >
            Logs
          </Link>
          <Link
            to={`/instances/${instanceId}/contacts`}
            className="border-outline-variant text-outline hover:bg-surface-container-high rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
          >
            Contatos
          </Link>
          <span className="text-outline text-[10px] font-bold uppercase tracking-widest">
            Last sync: {lastSync}
          </span>
                <button
                  type="button"
                  onClick={() => {
                    void loadHealth();
                    void loadWhatsAppStatus();
                  }}
                  disabled={healthLoading}
                  className="rounded p-2 transition-colors hover:bg-surface-container-high"
                  aria-label="Atualizar status"
                >
            <Icon name="refresh" className="text-sm" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {showAutoReconnect && (
          <div className="lg:col-span-12" id="whatsapp-auto-reconnect">
            <div className="flex flex-col gap-4 rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/95 to-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-200/60"
                  aria-hidden
                >
                  <span
                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700"
                    aria-hidden
                  />
                </div>
                <div>
                  <h3 className="text-slate-900 font-semibold leading-tight">Reconectando sessão do WhatsApp</h3>
                  <p className="text-slate-600 mt-1 max-w-xl text-sm leading-relaxed">
                    O servidor foi reiniciado e está restaurando a sessão salva. Aguarde alguns segundos antes de
                    gerar um novo QR.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadWhatsAppStatus();
                  void loadQr();
                }}
                className="bg-sky-100 text-sky-900 hover:bg-sky-200 flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-colors min-w-[200px]"
              >
                Atualizar status
              </button>
            </div>
          </div>
        )}

        {showConnectCta && (
          <div className="lg:col-span-12" id="whatsapp-connect-cta">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/95 to-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                  aria-hidden
                >
                  <Icon name="qr_code_scanner" className="text-[22px]" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-semibold leading-tight">WhatsApp desconectado</h3>
                  <p className="text-slate-600 mt-1 max-w-xl text-sm leading-relaxed">
                    Cada usuário do painel tem sua própria sessão. Clique para gerar o QR e escanear com o aplicativo
                    WhatsApp (Aparelhos conectados).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleStartPairing()}
                disabled={pairingRequestLoading}
                className="bg-amber-500 text-amber-950 hover:bg-amber-400 flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-colors disabled:opacity-60 min-w-[200px]"
              >
                {pairingRequestLoading ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-950/30 border-t-amber-950"
                      aria-hidden
                    />
                    Conectando…
                  </>
                ) : (
                  'Gerar QR para parear'
                )}
              </button>
            </div>
          </div>
        )}

        {showPairingQr && (
          <div className="lg:col-span-12" id="whatsapp-pairing">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/95 to-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
              <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-amber-300 to-sky-400" />
              <div className="flex flex-col gap-8 p-6 sm:p-8 md:flex-row md:items-start md:gap-10 lg:gap-14">
                <div className="w-full min-w-0 flex-1 space-y-4">
                  <div className="flex gap-4 sm:gap-5">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 shadow-inner ring-1 ring-amber-200/60 sm:h-12 sm:w-12"
                      aria-hidden
                    >
                      <Icon name="qr_code_scanner" className="text-[22px] sm:text-2xl" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h3 className="text-slate-900 text-lg font-semibold leading-tight tracking-tight sm:text-xl">
                          Conectar WhatsApp
                        </h3>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900/90">
                          Pareamento
                        </span>
                      </div>
                      <p className="text-slate-600 text-pretty text-sm leading-relaxed sm:text-[15px]">
                        Abra o WhatsApp no telefone →{' '}
                        <span className="font-medium text-slate-700">Aparelhos conectados</span> → escaneie o código ao
                        lado. O QR também aparece no terminal do servidor. Até concluir, o envio de mensagens responde com{' '}
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">503</code>.
                      </p>
                      {!qrPayload && (
                        <p className="text-slate-500 border-l-slate-200 mt-1 border-l-2 pl-3 text-sm leading-relaxed">
                          {waitingForQr
                            ? 'Abrindo o WhatsApp Web no servidor e gerando o código — pode levar alguns segundos.'
                            : 'Aguardando o QR… Depois de escanear, o status atualiza automaticamente.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className="flex w-full shrink-0 justify-center md:w-auto md:justify-end md:pt-1"
                  aria-busy={waitingForQr && !qrPayload}
                >
                  {qrPayload ? (
                    <div className="w-full max-w-[240px] rounded-2xl bg-white p-4 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 sm:max-w-none">
                      <QRCode
                        value={qrPayload}
                        size={200}
                        fgColor="#0f172a"
                        bgColor="#ffffff"
                        style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                        viewBox="0 0 256 256"
                      />
                      <p className="text-slate-400 mt-3 text-center text-xs font-medium tracking-wide">
                        Escaneie com a câmera do WhatsApp
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-[240px] w-full max-w-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 p-6 text-center">
                      <span
                        className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-amber-500"
                        aria-hidden
                      />
                      <div>
                        <p className="text-slate-700 text-sm font-semibold leading-snug">
                          {waitingForQr ? 'Preparando o QR code' : 'Gerando QR…'}
                        </p>
                        {waitingForQr && (
                          <p className="text-slate-500 mt-1 text-xs leading-relaxed">
                            Aguarde enquanto o Chrome abre a sessão no servidor.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 lg:col-span-5">
          <section
            id="service-health"
            className="bg-surface-container-low relative overflow-hidden rounded-xl p-6"
          >
            <div className="mb-6 flex items-start justify-between">
              <h2 className="text-primary-dim text-xs font-bold uppercase tracking-widest">Service Health</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-container-lowest flex items-center justify-between rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      whatsappReady ? 'bg-tertiary-container' : 'bg-error-container'
                    }`}
                  >
                    <Icon
                      name={whatsappReady ? 'link' : 'link_off'}
                      className={whatsappReady ? 'text-on-tertiary-container' : 'text-on-error-container'}
                    />
                  </div>
                  <div>
                    <p className="text-outline text-xs font-bold uppercase leading-tight">WhatsApp Ready</p>
                    <p className={`text-lg font-bold ${whatsappReady ? 'text-tertiary' : 'text-error'}`}>
                      {whatsappReady === null ? '…' : whatsappReady ? 'ONLINE' : 'OFFLINE'}
                    </p>
                  </div>
                </div>
                {whatsappReady === false && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900/80 ring-1 ring-amber-200/80">
                    Parear
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDisconnectWhatsApp()}
                disabled={disconnectLoading || whatsappReady !== true}
                className="bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:opacity-60 disabled:cursor-not-allowed flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
              >
                <Icon name="link_off" className="text-sm" />
                {disconnectLoading ? 'Desconectando…' : 'Desconectar WhatsApp'}
              </button>

              <div className="bg-surface-container-lowest rounded-lg p-4">
                <p className="text-outline mb-2 text-[10px] font-bold uppercase tracking-wide">Foto de perfil</p>
                <div className="mb-3 flex items-center gap-3">
                  {currentProfilePhotoUrl ? (
                    <img
                      src={currentProfilePhotoUrl}
                      alt="Foto atual do WhatsApp"
                      className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="bg-slate-200 text-slate-600 flex h-14 w-14 items-center justify-center rounded-full text-[10px] font-bold">
                      SEM FOTO
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">Foto atual</p>
                    <p className="text-outline text-[10px]">
                      {currentPhotoLoading ? 'Carregando…' : currentProfilePhotoUrl ? 'Obtida da sessão Baileys' : 'Nenhuma foto definida'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadCurrentProfilePhoto()}
                    disabled={whatsappReady !== true || currentPhotoLoading}
                    className="border-outline-variant text-outline ml-auto rounded-md border px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-60"
                  >
                    Atualizar
                  </button>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={whatsappReady !== true || profilePhotoLoading}
                  onChange={(e) => handleProfilePhotoSelected(e.target.files?.[0] ?? null)}
                  className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-slate-300 disabled:opacity-60"
                />
                {profilePhotoPreviewUrl && (
                  <div className="mt-3">
                    <img
                      src={profilePhotoPreviewUrl}
                      alt="Pré-visualização da nova foto de perfil"
                      className="h-24 w-24 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleUpdateProfilePhoto()}
                  disabled={whatsappReady !== true || profilePhotoLoading || !profilePhotoFile}
                  className="bg-primary text-on-primary mt-3 w-full rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profilePhotoLoading ? 'Atualizando…' : 'Atualizar foto do WhatsApp'}
                </button>
                <p className="text-outline mt-2 text-[10px]">JPG, PNG ou WEBP. Máximo 2MB.</p>
                {profilePhotoError && (
                  <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-xs text-error" role="alert">
                    {profilePhotoError}
                  </p>
                )}
                {profilePhotoSuccess && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">
                    {profilePhotoSuccess}
                  </p>
                )}
              </div>

              {healthError && (
                <div className="border-error flex gap-4 rounded-lg border-l-4 bg-error-container/20 p-4">
                  <Icon name="error" className="text-error shrink-0" />
                  <div>
                    <p className="text-on-error-container text-sm font-bold">API indisponível</p>
                    <p className="text-on-error-container/80 mt-1 text-xs">{healthError}</p>
                    {/failed to fetch/i.test(healthError) && (
                      <p className="text-on-error-container/85 mt-2 text-[11px] leading-snug">
                        Dica: em produção, apague a Base URL no Overview se ainda apontar para localhost, ou use
                        sempre <span className="font-mono">https://</span> quando o site estiver em HTTPS.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>

        <div className="space-y-6 lg:col-span-7">
          <section className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-8 shadow-sm">
            <h2 className="text-primary-dim mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
              <Icon name="terminal" className="text-sm" />
              Message Sender
            </h2>
            <form className="space-y-6" onSubmit={handleSend}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="text-outline mb-2 block text-[10px] font-black uppercase tracking-widest">
                    Phone Number
                  </label>
                  <div className="flex">
                    <span className="border-outline-variant/10 bg-surface-container-high text-outline flex items-center rounded-l-lg border-r px-3 text-xs font-bold">
                      +
                    </span>
                        <input
                          className="focus:ring-primary/20 w-full rounded-r-lg border-none bg-surface-container-low p-3 text-sm transition-all focus:ring-2"
                          placeholder="+55 11 99999-9999"
                          type="text"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) =>
                            setPhone(e.target.value.replace(/[^\d+()\s\-]/g, '').slice(0, 25))
                          }
                        />
                  </div>
                  <p className="text-outline mt-2 text-[10px]">
                    Pode incluir +, espaços e traços; o envio usa só os dígitos (10 a 15).
                  </p>
                </div>
                <div className="col-span-full md:col-span-2">
                  <label className="text-outline mb-2 block text-[10px] font-black uppercase tracking-widest">
                    Mensagem
                  </label>
                  <div className="relative">
                    <textarea
                      className="text-on-surface focus:ring-primary/20 w-full rounded-lg border-none bg-surface-container-low p-3 font-mono text-sm transition-all focus:ring-2"
                      maxLength={200}
                      placeholder="Digite a mensagem para enviar no WhatsApp"
                      rows={3}
                      value={code}
                      onChange={(e) => setCode(e.target.value.slice(0, 200))}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <Icon name="lock" className="text-outline/50 text-xs" />
                    </div>
                  </div>
                      <div className="mt-2 flex justify-between">
                        <p className="text-outline text-[10px]">Até 200 caracteres por mensagem.</p>
                        <p className={`text-[10px] font-bold ${codeValid ? 'text-tertiary' : 'text-outline'}`}>
                          {codeValid ? 'OK' : '—'}
                        </p>
                      </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  className="bg-primary text-on-primary flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  type="submit"
                  disabled={sendLoading}
                >
                  <Icon name="send" className="text-sm" />
                  {sendLoading ? 'ENVIANDO…' : 'EXECUTE TEST'}
                </button>
                <button
                  className="border-outline-variant text-outline hover:bg-surface-container-low rounded-lg border px-6 text-[10px] font-bold uppercase transition-colors"
                  type="button"
                  onClick={handleClearForm}
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="bg-surface-container-highest flex h-[280px] flex-col rounded-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-primary-dim flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Icon name="code" className="text-sm" />
                Response Log
              </h2>
              <button
                type="button"
                onClick={handleCopyJson}
                className="text-primary hover:underline flex items-center gap-1 text-[10px] font-bold"
              >
                <Icon name="content_copy" className="text-xs" />
                COPY JSON
              </button>
            </div>
            <div className="border-white/5 flex-1 overflow-y-auto rounded-lg border bg-[#1a1c1e] p-4 font-mono text-[11px] text-emerald-200/90 shadow-inner no-scrollbar">
              <pre className="whitespace-pre-wrap break-words">{responseLog}</pre>
            </div>
          </section>

          <section className="bg-surface-container-low relative overflow-hidden rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-primary-dim text-xs font-bold uppercase tracking-widest">Message Listener</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  listeningEnabled
                    ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80'
                    : 'bg-slate-200 text-slate-700 ring-1 ring-slate-300/70'
                }`}
              >
                {listeningEnabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <p className="text-outline text-xs leading-relaxed">
              Abra um canal Socket.IO para aplicações externas receberem mensagens recebidas em tempo real. Apenas um modo
              de receção por instância: se ativar isto, o <strong>webhook</strong> é desligado automaticamente.
            </p>
            <p className="text-outline mt-3 text-[11px]">
              Clientes conectados: <span className="font-semibold text-slate-700">{listeningClients}</span>
            </p>

            {listeningError && (
              <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error" role="alert">
                {listeningError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleToggleListening()}
                disabled={listeningLoading}
                className="bg-primary text-on-primary rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60"
              >
                {listeningLoading
                  ? 'Atualizando…'
                  : listeningEnabled
                    ? 'Parar escuta'
                    : 'Escutar mensagens'}
              </button>
              <button
                type="button"
                onClick={() => void loadListeningStatus()}
                className="border-outline-variant text-outline rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide"
              >
                Atualizar
              </button>
            </div>
          </section>

          <section className="bg-surface-container-low relative overflow-hidden rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-primary-dim text-xs font-bold uppercase tracking-widest">Webhook</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  webhookEnabled && webhookUrl.trim().length > 0
                    ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80'
                    : 'bg-slate-200 text-slate-700 ring-1 ring-slate-300/70'
                }`}
              >
                {webhookEnabled && webhookUrl.trim().length > 0 ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-outline text-xs leading-relaxed">
              Receba mensagens no seu endpoint com <span className="font-mono">POST</span> (JSON) sempre que
              chegar uma mensagem. Apenas um modo por instância: ao <strong>ativar o webhook</strong>, o Message Listener
              (Socket) é desligado automaticamente. Em produção use <span className="font-mono">https://</span>.
            </p>
            {webhookHasSecret && webhookSecretLast4 && (
              <p className="text-outline mt-2 text-[11px]">
                Segredo (sufixo): <span className="font-mono font-semibold text-slate-600">…{webhookSecretLast4}</span>
              </p>
            )}
            {webhookRevealedSecret && (
              <div className="bg-amber-50 border-amber-200/80 mt-3 rounded-lg border p-3 text-xs text-amber-950">
                <p className="font-semibold">Guarde o segredo agora — não será mostrado de novo.</p>
                <p className="mt-1 break-all font-mono text-[11px]">{webhookRevealedSecret}</p>
                <button
                  type="button"
                  className="mt-2 text-[10px] font-bold uppercase text-amber-900 underline"
                  onClick={() => void navigator.clipboard.writeText(webhookRevealedSecret)}
                >
                  Copiar segredo
                </button>
              </div>
            )}
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-outline mb-1 block text-[10px] font-bold uppercase">URL do webhook</span>
                <input
                  type="url"
                  className="border-outline-variant focus:ring-primary/30 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://seu-servidor.com/webhook"
                  autoComplete="off"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                />
                <span className="text-outline text-sm">Ativar envio para esta URL</span>
              </label>
            </div>
            {webhookLoadError && (
              <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error" role="alert">
                {webhookLoadError}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveWebhook(false)}
                disabled={webhookSaveLoading}
                className="bg-primary text-on-primary rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60"
              >
                {webhookSaveLoading ? 'A guardar…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Gera um novo segredo. O anterior deixa de funcionar. Continuar?')) {
                    void handleSaveWebhook(true);
                  }
                }}
                disabled={webhookSaveLoading}
                className="border-outline-variant text-outline rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60"
              >
                Regenerar segredo
              </button>
              <button
                type="button"
                onClick={() => void loadWebhookConfig()}
                className="border-outline-variant text-outline rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide"
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => void handleTestWebhook()}
                disabled={webhookTestLoading}
                className="border-outline-variant text-outline rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60"
              >
                {webhookTestLoading ? 'A testar…' : 'Testar envio'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
