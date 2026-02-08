import { Handler } from "@netlify/functions";
import RiveScript from "rivescript";
import mysql from "mysql2/promise";
import path from "path";

export const handler: Handler = async (event) => {
  // ====== VERIFICACIÓN GET (META WEBHOOK) ======

  console.log("===== Function invoked =====");
  console.log("Method:", event.httpMethod);
  
  if (event.httpMethod === "GET") {
    console.log("Webhook verification request received");
    
    const params = event.queryStringParameters;
    console.log("Query params:", params);

    if (params?.["hub.verify_token"] === process.env.TOKEN) {
      console.log("Verification SUCCESS");
      
      return {
        statusCode: 200,
        body: params["hub.challenge"] || ""
      };
    }

    console.log("Verification FAILED");
    
    return {
      statusCode: 403,
      body: "Error de autentificacion."
    };
  }

  // ====== POST MENSAJES ======
  try {
    console.log("Incoming POST body:", event.body);
    
    const data = JSON.parse(event.body || "{}");

    const telefonoCliente =
      data.entry[0].changes[0].value.messages[0].from;

    const mensaje =
      data.entry[0].changes[0].value.messages[0].text.body;

    const idWA =
      data.entry[0].changes[0].value.messages[0].id;

    const timestamp =
      data.entry[0].changes[0].value.messages[0].timestamp;

    console.log("Telefono:", telefonoCliente);
    console.log("Mensaje:", mensaje);
    console.log("ID WA:", idWA);
    console.log("Timestamp:", timestamp);

    if (!mensaje) {
      return { statusCode: 200, body: "ok" };
    }

    // ====== RIVESCRIPT ======
    console.log("Loading RiveScript...");

    const bot = new RiveScript();

    const rivePath = path.join(__dirname, "IA.rive");
    console.log("Ruta IA.rive:", rivePath);

    await bot.loadFile(rivePath);
    await bot.sortReplies();

    let respuesta = await bot.reply("localuser", mensaje);
    respuesta = respuesta.replace("\\n", "\n").replace("\\", "");

    console.log("Respuesta generada:", respuesta);

    // ====== MYSQL ======
    console.log("Connecting to MySQL...");
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    console.log("Checking if message already exists...");
    
    const [rows]: any = await connection.execute(
      "SELECT count(id) as cantidad FROM registro WHERE id_wa=?",
      [idWA]
    );

    const cantidad = rows[0].cantidad;

    console.log("Cantidad encontrada:", cantidad);

    if (cantidad === 0) {
      console.log("Inserting new record...");
      
      await connection.execute(
        `INSERT INTO registro
        (mensaje_recibido, mensaje_enviado, id_wa, timestamp_wa, telefono_wa)
        VALUES (?, ?, ?, ?, ?)`,
        [mensaje, respuesta, idWA, timestamp, telefonoCliente]
      );

      console.log("Insert completed");
    }

    await connection.end();

    console.log("Connection closed");

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
