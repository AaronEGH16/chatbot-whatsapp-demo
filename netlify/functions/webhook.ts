import { Handler } from "@netlify/functions";
import RiveScript from "rivescript";
import mysql from "mysql2/promise";
import path from "path";

export const handler: Handler = async (event) => {
  // ====== VERIFICACIÓN GET (META WEBHOOK) ======
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters;

    if (params?.["hub.verify_token"] === process.env.TOKEN) {
      return {
        statusCode: 200,
        body: params["hub.challenge"] || ""
      };
    }

    return {
      statusCode: 403,
      body: "Error de autentificacion."
    };
  }

  // ====== POST MENSAJES ======
  try {
    const data = JSON.parse(event.body || "{}");

    const telefonoCliente =
      data.entry[0].changes[0].value.messages[0].from;

    const mensaje =
      data.entry[0].changes[0].value.messages[0].text.body;

    const idWA =
      data.entry[0].changes[0].value.messages[0].id;

    const timestamp =
      data.entry[0].changes[0].value.messages[0].timestamp;

    if (!mensaje) {
      return { statusCode: 200, body: "ok" };
    }

    // ====== RIVESCRIPT ======
    const bot = new RiveScript();
    await bot.loadFile(path.join(process.cwd(), "IA.rive"));
    bot.sortReplies();

    let respuesta = bot.reply("localuser", mensaje);
    respuesta = respuesta.replace("\\n", "\n").replace("\\", "");

    // ====== MYSQL ======
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    const [rows]: any = await connection.execute(
      "SELECT count(id) as cantidad FROM registro WHERE id_wa=?",
      [idWA]
    );

    const cantidad = rows[0].cantidad;

    if (cantidad === 0) {
      await connection.execute(
        `INSERT INTO registro
        (mensaje_recibido, mensaje_enviado, id_wa, timestamp_wa, telefono_wa)
        VALUES (?, ?, ?, ?, ?)`,
        [mensaje, respuesta, idWA, timestamp, telefonoCliente]
      );
    }

    await connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success" })
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      body: "error"
    };
  }
};
