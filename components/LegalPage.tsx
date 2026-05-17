import { CookieConsent } from './CookieConsent';
import { LegalFooter } from './LegalFooter';

function PrivacyContent() {
  return (
    <div className="space-y-8 text-zinc-300 leading-7">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de sus datos personales es <strong className="text-white">Anclora Group</strong>.
          Puede contactar con nosotros en{' '}
          <a href="mailto:hola@anclora.com" className="text-blue-400 hover:underline">hola@anclora.com</a> para
          cualquier cuestión relacionada con la privacidad.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">2. Datos que tratamos</h2>
        <p>Durante el uso de Anclora LinguoCAM tratamos las siguientes categorías de datos:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li><strong className="text-white">Datos de sesión y llamada:</strong> identificador de sala, configuración de audio/video y preferencias de idioma seleccionadas.</li>
          <li><strong className="text-white">Transcripciones de audio:</strong> el audio captado por el micrófono se procesa en tiempo real para generar la traducción. Las transcripciones no se almacenan de forma permanente salvo que el usuario solicite expresamente guardar la grabación.</li>
          <li><strong className="text-white">Metadatos de conexión WebRTC:</strong> direcciones IP y datos de señalización necesarios para establecer la llamada.</li>
          <li><strong className="text-white">Cámara y micrófono:</strong> el acceso a estos dispositivos se produce únicamente durante la llamada activa. El sistema no accede a ellos fuera de la sesión.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">3. Finalidad del tratamiento</h2>
        <p>
          Los datos se tratan exclusivamente para prestar el servicio de videoconferencia con traducción en tiempo
          real multilingüe (ES/EN/DE/RU/FR/IT) que constituye Anclora LinguoCAM.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">4. Base jurídica</h2>
        <p>
          El tratamiento se basa en el <strong className="text-white">consentimiento</strong> del usuario al aceptar
          los presentes términos y en el <strong className="text-white">interés legítimo</strong> de Anclora Group
          para garantizar el correcto funcionamiento técnico del servicio (art. 6.1.a y 6.1.f del RGPD).
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">5. Conservación de datos</h2>
        <p>
          Los datos de llamada (audio, transcripciones temporales, metadatos de señalización) no se conservan
          tras la finalización de la sesión. Las preferencias de idioma y configuración local persisten
          en el <code className="rounded bg-zinc-800 px-1 text-sm">localStorage</code> del navegador del usuario
          hasta que este las elimine manualmente.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">6. Comunicación de datos a terceros</h2>
        <p>
          No cedemos sus datos a terceros con fines comerciales. Únicamente pueden acceder a los datos los
          proveedores de infraestructura WebRTC estrictamente necesarios para el encaminamiento de la llamada,
          quienes actúan como encargados del tratamiento bajo contrato de confidencialidad.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">7. Permisos del navegador</h2>
        <p>
          El servicio requiere que el navegador conceda acceso a la <strong className="text-white">cámara</strong> y
          al <strong className="text-white">micrófono</strong>. Estos permisos son necesarios para la prestación del
          servicio y pueden revocarse en cualquier momento desde la configuración del navegador, aunque ello
          impedirá el uso de Anclora LinguoCAM.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">8. Cifrado y seguridad</h2>
        <p>
          Las llamadas se transmiten mediante <strong className="text-white">WebRTC</strong>, que incorpora cifrado
          nativo DTLS/SRTP. No se garantiza cifrado extremo a extremo (E2EE) adicional salvo cuando esta
          funcionalidad esté explícitamente habilitada en la configuración de la sala. Anclora Group aplica medidas
          técnicas y organizativas para proteger los datos frente a accesos no autorizados.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">9. Cookies</h2>
        <p>
          Anclora LinguoCAM utiliza cookies técnicas necesarias para el funcionamiento de la sesión segura y
          las preferencias de llamada. Las categorías opcionales de cookies pueden gestionarse desde el panel
          de preferencias disponible en el pie de página.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">10. Sus derechos (RGPD)</h2>
        <p>En virtud del Reglamento General de Protección de Datos tiene derecho a:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Acceder a sus datos personales.</li>
          <li>Rectificar datos inexactos o incompletos.</li>
          <li>Suprimir sus datos cuando ya no sean necesarios.</li>
          <li>Oponerse al tratamiento o solicitar su limitación.</li>
          <li>Solicitar la portabilidad de sus datos.</li>
          <li>Retirar el consentimiento en cualquier momento, sin que ello afecte a la licitud del tratamiento previo.</li>
          <li>Presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).</li>
        </ul>
        <p className="mt-3">
          Para ejercer cualquiera de estos derechos, póngase en contacto con nosotros en{' '}
          <a href="mailto:hola@anclora.com" className="text-blue-400 hover:underline">hola@anclora.com</a>.
        </p>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-8 text-zinc-300 leading-7">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">1. Objeto del servicio</h2>
        <p>
          Anclora LinguoCAM es un servicio de videoconferencia con traducción simultánea mediante inteligencia
          artificial en tiempo real, con soporte multilingüe (ES/EN/DE/RU/FR/IT). La plataforma utiliza tecnología
          WebRTC para la comunicación de vídeo y audio, y modelos de IA para la transcripción y traducción.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">2. Limitaciones de la traducción automática</h2>
        <p>
          Las traducciones generadas por Anclora LinguoCAM son <strong className="text-white">orientativas</strong> y
          pueden contener errores, omisiones o imprecisiones. El servicio{' '}
          <strong className="text-white">no sustituye</strong> en ningún caso:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>La interpretación profesional certificada o jurada.</li>
          <li>El asesoramiento médico, diagnóstico o tratamiento clínico.</li>
          <li>El asesoramiento jurídico o legal.</li>
          <li>El asesoramiento financiero, fiscal o de inversión.</li>
          <li>Cualquier otro servicio profesional regulado.</li>
        </ul>
        <p className="mt-3">
          Para contextos que requieran precisión certificada, el usuario debe recurrir a profesionales habilitados.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">3. Uso del servicio</h2>
        <p>Al utilizar Anclora LinguoCAM, el usuario se compromete a:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Consentir el uso de la <strong className="text-white">cámara y el micrófono</strong> del dispositivo durante la llamada activa.</li>
          <li>No grabar conversaciones sin el consentimiento expreso de todos los participantes.</li>
          <li>No utilizar el servicio para difundir contenido ilegal, difamatorio, ofensivo, discriminatorio o que vulnere derechos de terceros.</li>
          <li>No realizar ingeniería inversa, descompilar ni intentar acceder al código fuente de la plataforma.</li>
          <li>No sobrecargar la infraestructura ni realizar ataques de denegación de servicio.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">4. Disponibilidad del servicio</h2>
        <p>
          La disponibilidad de Anclora LinguoCAM está sujeta a las condiciones técnicas de la infraestructura,
          la conectividad de red del usuario y el correcto funcionamiento de los proveedores de servicios subyacentes.
          Anclora Group no garantiza una disponibilidad ininterrumpida y se reserva el derecho de realizar
          mantenimientos o actualizaciones que puedan afectar temporalmente al servicio.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">5. Propiedad intelectual</h2>
        <p>
          Todos los derechos de propiedad intelectual e industrial sobre la plataforma Anclora LinguoCAM —
          incluidos el diseño, el código fuente, los modelos de IA integrados, la interfaz de usuario y la
          documentación — pertenecen a <strong className="text-white">Anclora Group</strong>. Queda prohibida
          su reproducción, distribución o uso no autorizado.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">6. Responsabilidad</h2>
        <p>
          Anclora Group no será responsable de los daños derivados de la inexactitud de las traducciones, la
          interrupción del servicio, la pérdida de datos de llamada o el uso indebido de la plataforma por
          parte del usuario. El usuario asume la responsabilidad del uso que realice del servicio.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">7. Modificaciones</h2>
        <p>
          Anclora Group se reserva el derecho de modificar los presentes términos con publicación de la nueva
          versión en esta página. El uso continuado del servicio tras la publicación implica la aceptación
          de los términos actualizados.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">8. Ley aplicable</h2>
        <p>
          Los presentes términos se rigen por la legislación española. Para cualquier controversia, las partes
          se someten a los juzgados y tribunales competentes conforme a la normativa vigente.
        </p>
      </section>
    </div>
  );
}

function LegalNoticeContent() {
  return (
    <div className="space-y-8 text-zinc-300 leading-7">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">1. Titular y operador</h2>
        <p>
          El titular y operador de la plataforma Anclora LinguoCAM es <strong className="text-white">Anclora Group</strong>.
          Para cualquier consulta, puede contactar en{' '}
          <a href="mailto:hola@anclora.com" className="text-blue-400 hover:underline">hola@anclora.com</a>.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">2. Sobre Anclora LinguoCAM</h2>
        <p>
          Anclora LinguoCAM forma parte del ecosistema tecnológico de Anclora Group. La plataforma ofrece
          servicios de videoconferencia con traducción simultánea por inteligencia artificial, con soporte
          multilingüe orientado a la comunicación global.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">3. Naturaleza del servicio</h2>
        <p>
          Anclora LinguoCAM facilita la comunicación y la traducción entre usuarios mediante tecnología WebRTC
          e inteligencia artificial. La plataforma <strong className="text-white">no emite certificados de
          interpretación</strong> ni acredita la exactitud de las traducciones generadas. Las traducciones
          tienen carácter orientativo y no sustituyen la interpretación profesional certificada.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">4. Responsabilidad sobre el contenido</h2>
        <p>
          El contenido generado, compartido o transmitido por los usuarios durante las sesiones es
          responsabilidad exclusiva de estos. Anclora Group no se hace responsable de los contenidos
          producidos por los participantes en las llamadas ni de las interpretaciones derivadas de las
          traducciones automáticas.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">5. Propiedad intelectual e industrial</h2>
        <p>
          Todos los elementos de la plataforma —diseño visual, código, modelos integrados, nombre comercial
          y marca Anclora LinguoCAM— son propiedad de Anclora Group. Queda prohibida su reproducción o uso
          sin autorización expresa por escrito.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">6. Legislación aplicable</h2>
        <p>
          Este aviso legal se rige por la legislación española y la normativa de la Unión Europea aplicable,
          en particular el Reglamento (UE) 2016/679 (RGPD) y la Ley 34/2002 de Servicios de la Sociedad de
          la Información (LSSI).
        </p>
      </section>
    </div>
  );
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'legal' }) {
  const meta = {
    privacy: {
      label: 'Privacidad',
      title: 'Política de privacidad',
    },
    terms: {
      label: 'Términos',
      title: 'Términos de servicio',
    },
    legal: {
      label: 'Aviso legal',
      title: 'Aviso legal',
    },
  } as const;

  const { title } = meta[kind];

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="mx-auto w-full max-w-4xl flex-grow px-6 py-16 pb-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-blue-400">Legal — Anclora LinguoCAM</p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">Última actualización: mayo de 2026</p>
          <hr className="mt-6 border-zinc-800" />
        </div>

        {/* Body */}
        {kind === 'privacy' && <PrivacyContent />}
        {kind === 'terms' && <TermsContent />}
        {kind === 'legal' && <LegalNoticeContent />}

        {/* Contact box */}
        <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="font-semibold text-white">Contacto legal</p>
          <a href="mailto:hola@anclora.com" className="mt-1 block text-sm text-blue-400 hover:underline">
            hola@anclora.com
          </a>
        </div>

        {/* Back button */}
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Volver
          </a>
          {kind !== 'privacy' && (
            <a href="/privacy" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white">
              Política de privacidad
            </a>
          )}
          {kind !== 'terms' && (
            <a href="/terms" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white">
              Términos de servicio
            </a>
          )}
          {kind !== 'legal' && (
            <a href="/legal" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white">
              Aviso legal
            </a>
          )}
        </div>
      </div>

      {/* Footer in normal flow (not absolute) to avoid overlap with long content */}
      <LegalFooter />
      <CookieConsent />
    </div>
  );
}
