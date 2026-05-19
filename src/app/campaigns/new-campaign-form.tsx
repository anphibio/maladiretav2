"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  FilePlus2,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Paperclip,
  Underline,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RecipientMode = "csv" | "txt" | "manual";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function NewCampaignForm({ senderEmail }: { senderEmail: string }) {
  const router = useRouter();
  const htmlEditorRef = useRef<HTMLDivElement>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<"draft" | "send" | "schedule">("draft");
  const [error, setError] = useState<string | null>(null);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("csv");
  const [htmlEditor, setHtmlEditor] = useState(true);

  function focusHtmlEditor() {
    htmlEditorRef.current?.focus();
  }

  function runEditorCommand(command: string, value?: string) {
    focusHtmlEditor();
    document.execCommand(command, false, value);
  }

  function insertHtml(html: string) {
    focusHtmlEditor();
    document.execCommand("insertHTML", false, html);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const nativeEvent = event.nativeEvent as SubmitEvent;
    const intent =
      nativeEvent.submitter instanceof HTMLButtonElement
        ? (nativeEvent.submitter.value as "draft" | "send" | "schedule")
        : submitIntent;
    setSubmitIntent(intent);

    const formData = new FormData(event.currentTarget);
    const bodyContent = htmlEditor ? (htmlEditorRef.current?.innerHTML ?? "") : (textEditorRef.current?.value ?? "");
    const plainText = htmlEditor ? (htmlEditorRef.current?.innerText ?? "").trim() : bodyContent.trim();

    if (!plainText) {
      setIsLoading(false);
      setError("Informe o corpo da mensagem.");
      return;
    }

    formData.set("bodyMode", htmlEditor ? "html" : "text");
    formData.set("htmlBody", htmlEditor ? bodyContent : `<pre>${escapeHtml(bodyContent)}</pre>`);
    formData.set("textBody", htmlEditor ? bodyContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : bodyContent);
    formData.set("recipientMode", recipientMode);
    formData.set("intent", intent);

    if (intent === "schedule" && !String(formData.get("scheduledAt") ?? "").trim()) {
      setIsLoading(false);
      setError("Informe a data e hora do agendamento.");
      return;
    }

    if (intent !== "schedule") {
      formData.delete("scheduledAt");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "Não foi possível criar a campanha.");
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "A preparação demorou demais. Verifique se banco, Redis e SMTP estão respondendo."
          : "Não foi possível comunicar com o servidor."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        <FilePlus2 className="mr-2 h-4 w-4" />
        Nova campanha
      </Button>
    );
  }

  const recipientHelp =
    recipientMode === "csv"
      ? "O CSV pode ter uma coluna chamada email, e outras colunas podem ser usadas como {{nome}}, {{cargo}} ou similares."
      : recipientMode === "txt"
        ? "O TXT deve ter um destinatário por linha. Use email ou email;nome."
        : "Informe um destinatário por linha. Use email ou email;nome.";

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Nova campanha</h2>
          <p className="mt-1 text-sm text-muted-foreground">Remetente fixo: {senderEmail}</p>
        </div>
        <Button className="h-9 px-3" type="button" variant="ghost" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-950">Destinatários</h3>
          <div className="mb-3 grid max-w-3xl grid-cols-3 rounded-lg bg-slate-100 p-1">
            {[
              ["csv", "CSV"],
              ["txt", "TXT"],
              ["manual", "Informar"]
            ].map(([mode, label]) => (
              <button
                key={mode}
                className={`h-12 rounded-md text-sm font-semibold transition ${
                  recipientMode === mode ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-950"
                }`}
                type="button"
                onClick={() => setRecipientMode(mode as RecipientMode)}
              >
                {label}
              </button>
            ))}
          </div>
          {recipientMode === "manual" ? (
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              name="manualRecipients"
              placeholder="destinatario@exemplo.com;Nome do destinatário"
            />
          ) : (
            <input
              accept={recipientMode === "csv" ? ".csv,.xlsx" : ".txt"}
              className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
              name="recipientFile"
              type="file"
            />
          )}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{recipientHelp}</p>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-950">Mensagem</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Nome da campanha
              <Input className="mt-2" name="name" placeholder="Comunicado institucional" required />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Assunto
              <Input className="mt-2" name="subject" placeholder="Assunto da mensagem" required />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input checked={htmlEditor} className="h-4 w-4" type="checkbox" onChange={(event) => setHtmlEditor(event.target.checked)} />
              Editor HTML
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input className="h-4 w-4" name="sendCopyToSelf" type="checkbox" />
              Enviar cópia para mim no final
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-800">
            {htmlEditor ? "Corpo em HTML" : "Corpo em texto puro"}
          </label>
          {htmlEditor ? (
            <div className="mt-2 rounded-md border border-border bg-slate-50">
              <div className="flex flex-wrap gap-2 border-b border-border p-3">
                <select className="h-9 rounded-md border border-border bg-white px-3 text-sm" onChange={(event) => runEditorCommand("formatBlock", event.target.value)}>
                  <option value="P">Simples</option>
                  <option value="H1">Título</option>
                  <option value="H2">Subtítulo</option>
                </select>
                <ToolbarButton label="Negrito" onClick={() => runEditorCommand("bold")}><Bold className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Itálico" onClick={() => runEditorCommand("italic")}><Italic className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Sublinhado" onClick={() => runEditorCommand("underline")}><Underline className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Lista" onClick={() => runEditorCommand("insertUnorderedList")}><List className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Lista numerada" onClick={() => runEditorCommand("insertOrderedList")}><ListOrdered className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Alinhar esquerda" onClick={() => runEditorCommand("justifyLeft")}><AlignLeft className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Centralizar" onClick={() => runEditorCommand("justifyCenter")}><AlignCenter className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Alinhar direita" onClick={() => runEditorCommand("justifyRight")}><AlignRight className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Link" onClick={() => runEditorCommand("createLink", window.prompt("URL do link") ?? "")}><LinkIcon className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Imagem" onClick={() => insertHtml(`<img src="${window.prompt("URL da imagem") ?? ""}" alt="">`)}><ImageIcon className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Código" onClick={() => runEditorCommand("formatBlock", "PRE")}><Code2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Limpar" onClick={() => { if (htmlEditorRef.current) htmlEditorRef.current.innerHTML = ""; }}><Eraser className="h-4 w-4" /></ToolbarButton>
              </div>
              <div
                ref={htmlEditorRef}
                className="min-h-48 w-full rounded-b-md bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                contentEditable
                role="textbox"
                suppressContentEditableWarning
              />
            </div>
          ) : (
            <textarea
              ref={textEditorRef}
              className="mt-2 min-h-48 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              name="bodyContent"
              placeholder="Mensagem institucional..."
              required
            />
          )}
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Paperclip className="h-5 w-5" />
            Anexos
          </h3>
          <input
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
            multiple
            name="attachments"
            type="file"
          />
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-950">Envio</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Agendar para
              <Input className="mt-2" name="scheduledAt" type="datetime-local" />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Senha do Zimbra
              <Input
                className="mt-2"
                name="queuePassword"
                placeholder="Opcional: a sessão atual será usada se ficar em branco"
                type="password"
              />
            </label>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Use “Agendar” para salvar com data futura. O disparo automático usa a credencial temporária do login quando disponível.
          </p>
        </section>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={isLoading} name="intentButton" value="draft" variant="secondary">
            {isLoading && submitIntent === "draft" ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button disabled={isLoading} name="intentButton" value="schedule" variant="secondary">
            {isLoading && submitIntent === "schedule" ? "Agendando..." : "Agendar"}
          </Button>
          <Button disabled={isLoading} name="intentButton" value="send">
            {isLoading && submitIntent === "send" ? "Preparando..." : "Enviar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-slate-800 hover:bg-slate-100"
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
