import { spawnSync } from 'node:child_process';

const PREFIX = 'dpapi:v1:';
const WIN32_DPAPI = String.raw`
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class KartDpapi {
  [StructLayout(LayoutKind.Sequential)] public struct Blob { public int Length; public IntPtr Data; }
  [DllImport("crypt32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool CryptProtectData(ref Blob input, string description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
  [DllImport("crypt32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool CryptUnprotectData(ref Blob input, out IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
  static Blob Input(byte[] data) { var b = new Blob { Length = data.Length, Data = Marshal.AllocHGlobal(Math.Max(1, data.Length)) }; Marshal.Copy(data, 0, b.Data, data.Length); return b; }
  static byte[] Output(Blob b) { var result = new byte[b.Length]; Marshal.Copy(b.Data, result, 0, b.Length); return result; }
  public static byte[] Protect(byte[] data) { var input = Input(data); try { Blob output; if (!CryptProtectData(ref input, "Kartodromo SMTP", IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 4, out output)) throw new Win32Exception(Marshal.GetLastWin32Error()); try { return Output(output); } finally { LocalFree(output.Data); } } finally { Marshal.FreeHGlobal(input.Data); } }
  public static byte[] Unprotect(byte[] data) { var input = Input(data); IntPtr description = IntPtr.Zero; try { Blob output; if (!CryptUnprotectData(ref input, out description, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0, out output)) throw new Win32Exception(Marshal.GetLastWin32Error()); try { return Output(output); } finally { LocalFree(output.Data); } } finally { if (description != IntPtr.Zero) LocalFree(description); Marshal.FreeHGlobal(input.Data); } }
}`;
const PROTEGER = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${WIN32_DPAPI}\n'@; $v=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($v); $p=[KartDpapi]::Protect($b); [Console]::Out.Write([Convert]::ToBase64String($p))`;
const REVELAR = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${WIN32_DPAPI}\n'@; $v=[Console]::In.ReadToEnd(); $p=[Convert]::FromBase64String($v); $b=[KartDpapi]::Unprotect($p); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))`;

function powershell(script: string, input: string): string {
  if (process.platform !== 'win32') throw new Error('O segredo local exige Windows DPAPI.');
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Não foi possível proteger/abrir o segredo com DPAPI.');
  return result.stdout;
}

/** Criptografa para a máquina; o arquivo de configuração continua protegido por ACL restrita. */
export function protegerSegredoLocal(secret: string): string {
  if (!secret) return PREFIX + 'empty';
  return PREFIX + powershell(PROTEGER, secret).trim();
}

/** Abre segredos DPAPI LocalMachine no servidor Windows. Aceita texto legado apenas para migração. */
export function revelarSegredoLocal(secret: string): string {
  if (!secret.startsWith(PREFIX)) return secret;
  if (secret === PREFIX + 'empty') return '';
  return powershell(REVELAR, secret.slice(PREFIX.length));
}
