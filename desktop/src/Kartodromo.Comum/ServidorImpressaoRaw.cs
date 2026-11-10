using System.IO;
using System.Net;
using System.Net.Sockets;

namespace Kartodromo.Comum;

/// <summary>
/// Ouvinte TCP RAW (porta 9100 / JetDirect) local que recebe impressões de rede (ex.: da Recepção)
/// e direciona para a impressora USB do totem via winspool.
/// </summary>
public static class ServidorImpressaoRaw
{
    static TcpListener _listener;
    static CancellationTokenSource _cts;

    public static void Iniciar(string impressora = null, int porta = 9100)
    {
        Task.Run(async () =>
        {
            try
            {
                var target = string.IsNullOrWhiteSpace(impressora) ? Relatorio.ObterImpressoraTermoPadrao() : impressora;
                if (string.IsNullOrWhiteSpace(target))
                {
                    Log("Servidor RAW 9100 não iniciado: nenhuma impressora térmica encontrada.");
                    return;
                }

                _cts = new CancellationTokenSource();
                _listener = new TcpListener(IPAddress.Any, porta);
                _listener.Start();
                Log($"Servidor RAW 9100 iniciado para '{target}'.");

                while (!_cts.IsCancellationRequested)
                {
                    TcpClient client;
                    try
                    {
                        client = await _listener.AcceptTcpClientAsync(_cts.Token);
                    }
                    catch (OperationCanceledException) { break; }
                    catch { break; }

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            using (client)
                            using (var stream = client.GetStream())
                            using (var ms = new MemoryStream())
                            {
                                client.ReceiveTimeout = 5000;
                                var buffer = new byte[4096];
                                int read;
                                while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                                {
                                    ms.Write(buffer, 0, read);
                                    if (!stream.DataAvailable)
                                    {
                                        await Task.Delay(150);
                                        if (!stream.DataAvailable) break;
                                    }
                                }
                                var data = ms.ToArray();
                                if (data.Length > 0)
                                {
                                    var ok = RawPrinterHelper.SendBytesToPrinter(target, data);
                                    Log($"Trabalho de {data.Length} bytes impresso em '{target}': {(ok ? "sucesso" : "falha")}");
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Log($"Erro ao processar trabalho recebido: {ex.Message}");
                        }
                    });
                }
            }
            catch (SocketException ex) when (ex.SocketErrorCode == SocketError.AddressAlreadyInUse)
            {
                Log($"Porta {porta} já em uso por outro serviço de impressão.");
            }
            catch (Exception ex)
            {
                Log($"Falha ao iniciar ouvinte RAW: {ex.Message}");
            }
        });
    }

    public static void Parar()
    {
        try
        {
            _cts?.Cancel();
            _listener?.Stop();
        }
        catch { }
    }

    static void Log(string msg)
    {
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo");
            Directory.CreateDirectory(pasta);
            File.AppendAllText(Path.Combine(pasta, "raw-printer.log"), $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {msg}{Environment.NewLine}");
        }
        catch { }
    }
}
