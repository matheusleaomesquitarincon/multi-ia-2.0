// Liga o servidor. O modo de produção é o padrão: quem esquece de configurar fica com as travas ligadas, e sem o
// endereço público o servidor prefere nem ligar a recusar todos os formulários sem explicação.

if (process.env.NODE_ENV !== "development") {
  process.env.NODE_ENV = "production";
  if (!process.env.SITE_URL) {
    console.error("Falta a variável SITE_URL (o endereço público do site). O servidor não vai ligar sem ela.");
    process.exit(1);
  }
}

const { createApp } = await import("./app.js");
// `||` e não `??`: o .env.example traz "PORT=" vazio, que deve valer 3001 (com `??` virava a porta 0, uma aleatória).
const port = Number(process.env.PORT || 3001);

createApp().listen(port, () => {
  console.log(`Servidor do Multi-IA em http://localhost:${port} (${process.env.NODE_ENV})`);
});
