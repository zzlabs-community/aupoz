export default function Docs() {
  return (
    <div className="prose prose-invert max-w-3xl">
      <h1>Docs — AUPOZ</h1>
      <p>Bienvenido a AUPOZ. Aquí encontrarás cómo usar el panel, configurar tu proveedor de IA y administrar tus activos. AUPOZ es una app creada por ZZLABZ.</p>
      <h2>Primeros pasos</h2>
      <ol>
        <li>Entra al Panel y usa la pestaña “Generar (Libre)”.</li>
        <li>Sube una imagen de referencia o pega la URL del producto.</li>
        <li>Elige plataforma y tamaño; pulsa Generar.</li>
      </ol>
      <h2>Modelos de IA</h2>
      <p>Próximamente podrás conectar tu propio proveedor y modelo por usuario (OpenAI, Anthropic, Google). Las claves se almacenarán cifradas en la base de datos.</p>
      <h2>Activos</h2>
      <p>Las imágenes generadas se guardan como activos en la base de datos y se sirven vía <code>/api/assets/&lt;id&gt;</code>. No usamos disco local.</p>
    </div>
  );
}
