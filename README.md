# Etiquetas ML — Leitor de endereços via OCR

Sistema **100% web e client-side** (funciona no celular e no PC) para escanear etiquetas de entrega via câmera, extrair o endereço com OCR e retornar o **número/código da planilha Excel** correspondente.

---

## 🔥 Como funciona (fluxo simplificado)

1. **Importar Excel** (uma única vez, fica salvo no navegador)
   - **Coluna A → Endereço completo** (ex: `Estrada das Lágrimas, 2945`)
   - **Coluna B → Número / Código** (ex: `2`)
2. **Escanear etiqueta**
   - Abre a câmera do celular → fotografar a etiqueta do pacote
   - Ou faz upload de uma imagem já salva
3. **OCR + Busca**
   - Extrai o texto da etiqueta com Tesseract.js
   - Identifica rua, número, bairro, CEP, cidade, UF
   - Normaliza (remove acentos, pontuação, expande abreviações)
   - Faz a busca **com pesos ponderados**:
     - CEP = 35% · Número do imóvel = 30% · Rua = 25% · Bairro = 5% · Cidade/UF = 5%
4. **Resultado**
   - Mostra o **NÚMERO DA COLUNA B em destaque gigante** (até 120px)
   - Exibe endereço lido vs. endereço da planilha
   - Mostra % de confiança e botão de **copiar número**

---

## 🚀 Como rodar localmente

Pré-requisito: **Node.js 18+**

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em modo desenvolvimento
npm run dev
```

Abre no navegador → **http://localhost:3000**

### Build de produção

```bash
npm run build
npm run start
```

---

## 📋 Formato da planilha Excel

Salve como `.xlsx` (recomendado), `.xls` ou `.csv`.

**Estrutura MÍNIMA obrigatória:**

| Coluna A (exemplo) | Coluna B (exemplo) |
|---|---|
| **endereço** | *(cabeçalho opcional — ou vazio)* |
| Estrada das Lágrimas, 2945 | **2** |
| Rua Antônio de Lotufo, 71 | **3** |
| Avenida Patente, 381 | **4** |
| Avenida Patente, 361 | **5** |
| Rua Luís Haag França, 189 | **6** |
| Rua Frei Juan Auli, 31 | **7** |
| Rua Anny, 1233 | **8** |
| Rua Zina Aita, 65 | **9** |

> 🎯 **Ao importar, o sistema já auto-mapeia automaticamente:**
> Coluna com "endereço/rua" → Endereço completo
> Coluna com "número/código" → Código a ser exibido
>
> Se errar, clique em **"Aplicar padrão (A/B)"** ou ajuste manualmente os dois selects.

---

## 🧠 Stack tecnológica

| Camada | O que usa |
|---|---|
| Framework | **Next.js 15** (App Router) + React 19 + TypeScript |
| UI | **Tailwind CSS** + componentes inspirados no shadcn/ui |
| OCR | **Tesseract.js** (Português + Inglês) — executa no navegador |
| Planilha | **SheetJS (xlsx)** — parse XLSX/XLS/CSV |
| Busca inteligente | **Fuse.js** + distância de **Levenshtein** |
| Estado | **Zustand** (persiste planilha e scan no localStorage) |
| Ícones | **Lucide React** |

---

## 🗂️ Estrutura de pastas

```
mercado-livre/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Tela inicial (Home)
│   │   ├── importar/page.tsx   # Importar Excel + mapear colunas
│   │   ├── escanear/page.tsx   # Câmera / Upload / OCR / Resultado
│   │   └── historico/page.tsx  # Histórico de consultas (exporta XLSX)
│   ├── components/
│   │   ├── CameraScanner.tsx   # Câmera nativa via getUserMedia
│   │   ├── ColumnMapper.tsx    # Mapeamento A→endereço B→número
│   │   ├── MatchCard.tsx       # Card do resultado com detalhes
│   │   ├── AddressForm.tsx     # Correção manual do endereço
│   │   └── ui/                 # Button, Card, Input, Badge, Progress, Select
│   ├── services/
│   │   ├── ocr/TesseractOcr.ts # Interface OcrService (trocável p/ Google Vision)
│   │   ├── spreadsheet/ExcelService.ts
│   │   ├── address/
│   │   │   ├── AddressNormalizer.ts # Remove acentos, pontuação, abreviações
│   │   │   ├── AddressParser.ts     # Extrai rua/nº/bairro/cidade/uf/cep
│   │   │   └── AddressMatcher.ts    # Score ponderado CEP 35% + nº 30%
│   │   └── history/HistoryService.ts
│   ├── stores/               # Zustand: planilha persistida + scan atual
│   ├── types/index.ts        # Tipos centrais (Endereco, Status, Pesos...)
│   └── lib/                  # utils, regex, supabase (opcional)
├── supabase/migrations/      # SQL p/ persistência em banco (opcional)
├── public/                   # favicon.svg, manifest PWA, robots.txt
└── package.json
```

---

## 🔄 Trocar OCR para Google Vision / Azure futuramente

A camada está abstraída em `src/services/ocr/index.ts`:

```ts
export interface OcrService {
  extrairTexto(
    imagem: File | string,
    onProgress?: (p: OcrProgresso) => void,
  ): Promise<OcrResultado>;
}
```

Basta criar um novo arquivo `GoogleVisionOcr.ts` implementando a mesma interface e trocar a fábrica em `getOcrService()`.

---

## 📱 Dicas de uso no celular

1. Abra o site no Chrome / Safari do celular (HTTPS é requerido para câmera)
2. **Adicione à tela inicial** para rodar como app (PWA)
3. Ao escanear:
   - Iluminação uniforme na etiqueta
   - Enquadre só a etiqueta (o sistema já mostra a moldura guia amarela)
   - Mantenha a distância pra não ficar desfocado
   - Se não sair de primeira → "Refazer foto" ou "Corrigir manualmente"

---

## 🗃️ Persistência dos dados

- **MVP atual:** Tudo fica salvo **no localStorage** do navegador
  - Planilha importada: chave `ml_planilha_v1`
  - Histórico de consultas: chave `ml_historico_consultas_v1`
- **Para multi-usuário:** Use as migrations do Supabase em `supabase/migrations/001_init.sql` e preencha as variáveis do `.env.local`.
