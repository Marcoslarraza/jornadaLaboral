class RegistroTurnos {
    constructor() {
        // Configuración de Supabase
        this.supabaseUrl = 'https://hqautqedjrbpcwaoroqq.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYXV0cWVkanJicGN3YW9yb3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzg2MTMsImV4cCI6MjA4MDM1NDYxM30.yBdy0Qkr5cAHkfESZ-p1051HPCu14T4XIil6AJgw0Gc';
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
        
        // Estado de autenticación
        this.usuario = null;
        this.userId = null;
        
        this.registros = [];
        this.jornadaActiva = null;
        this.mesActual = new Date();
        this.editandoId = null;
        
        this.inicializar();
    }

    // Métodos de autenticación
    async registrar(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            this.mostrarNotificacion('Registro exitoso. Revisa tu email para verificar.', 'success');
            return true;
        } catch (error) {
            console.error('Error en registro:', error);
            this.mostrarNotificacion('Error en registro: ' + error.message, 'error');
            return false;
        }
    }

    async login(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            this.usuario = data.user;
            this.userId = data.user.id;
            
            // Cargar datos del usuario
            await this.cargarJornadaActiva();
            await this.cargarRegistros();
            
            // Actualizar UI
            this.actualizarUI();
            
            this.mostrarNotificacion(`Bienvenido ${data.user.email}`, 'success');
            return true;
        } catch (error) {
            console.error('Error en login:', error);
            this.mostrarNotificacion('Error en login: ' + error.message, 'error');
            return false;
        }
    }

    async logout() {
        try {
            await this.supabase.auth.signOut();
            this.usuario = null;
            this.userId = null;
            this.registros = [];
            this.jornadaActiva = null;
            
            this.mostrarInterfazLogin();
            this.mostrarNotificacion('Sesión cerrada', 'success');
        } catch (error) {
            console.error('Error en logout:', error);
        }
    }

    async verificarSesion() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                this.usuario = session.user;
                this.userId = session.user.id;
                
                // Cargar datos del usuario
                await this.cargarJornadaActiva();
                await this.cargarRegistros();
                
                // Actualizar UI después de cargar datos
                this.actualizarUI();
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error verificando sesión:', error);
            return false;
        }
    }

    mostrarInterfazLogin() {
        const loginContainer = document.getElementById('auth-container');
        if (loginContainer) loginContainer.style.display = 'flex';
    }

    mostrarInterfazPrincipal() {
        this.actualizarUI();
    }

    actualizarUI() {
        const loginContainer = document.getElementById('auth-container');
        
        if (this.usuario) {
            if (loginContainer) loginContainer.style.display = 'none';
            
            // Actualizar info usuario
            const emailDisplay = document.getElementById('user-email-display');
            const nameDisplay = document.getElementById('greeting-name');
            const initialsDisplay = document.getElementById('user-initials');
            
            if (emailDisplay) emailDisplay.textContent = this.usuario.email;
            
            // Obtener nombre o usar parte del email
            const name = this.usuario.user_metadata?.full_name || this.usuario.email.split('@')[0];
            if (nameDisplay) nameDisplay.textContent = `Hola, ${name}`;
            
            if (initialsDisplay) {
                initialsDisplay.textContent = name.charAt(0).toUpperCase();
            }
            
            this.actualizarRegistrosMensuales();
            this.actualizarEstadoJornada();
        } else {
            if (loginContainer) loginContainer.style.display = 'flex';
        }
    }

    switchTab(tab) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const tabBtns = document.querySelectorAll('.tab-btn');
        
        if (tab === 'login') {
            if (loginForm) loginForm.classList.add('active');
            if (registerForm) registerForm.classList.remove('active');
        } else {
            if (loginForm) loginForm.classList.remove('active');
            if (registerForm) registerForm.classList.add('active');
        }
        
        // Actualizar tabs activos
        tabBtns.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tab === 'login' ? 'iniciar' : 'registr')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email-login').value;
        const password = document.getElementById('password-login').value;
        
        await this.login(email, password);
    }

    async handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('email-registro').value;
        const password = document.getElementById('password-registro').value;
        
        const registrado = await this.registrar(email, password);
        if (registrado) {
            this.switchTab('login');
        }
    }

    async inicializar() {
        // Verificar si hay una sesión activa
        const sesionActiva = await this.verificarSesion();
        
        if (sesionActiva) {
            this.mostrarInterfazPrincipal();
        } else {
            this.mostrarInterfazLogin();
        }
        
        this.actualizarFechaYHora();
        this.configurarEventListeners();
        
        // Actualizar hora cada segundo
        setInterval(() => this.actualizarFechaYHora(), 1000);
    }

    actualizarFechaYHora() {
        const ahora = new Date();
        
        // Actualizar fecha
        const fechaInput = document.getElementById('fecha');
        if (fechaInput) {
            const fechaString = ahora.toISOString().split('T')[0];
            fechaInput.value = fechaString;
        }
        
        // Actualizar horas
        const horaInicio = document.getElementById('hora-inicio');
        const horaFin = document.getElementById('hora-fin');
        const horaString = ahora.toTimeString().slice(0, 5);
        
        if (horaInicio && !this.jornadaActiva) {
            horaInicio.value = horaString;
        }
        if (horaFin && this.jornadaActiva) {
            horaFin.value = horaString;
        }
    }

    configurarEventListeners() {
        // Event listeners de autenticación
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const btnLogout = document.getElementById('btn-logout');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        if (btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
        
        // Tabs de login
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        
        if (tabLogin) {
            tabLogin.addEventListener('click', () => this.switchTab('login'));
        }
        if (tabRegister) {
            tabRegister.addEventListener('click', () => this.switchTab('register'));
        }
        
        // Botones de jornada
        const btnIniciar = document.getElementById('btn-iniciar');
        const btnFinalizar = document.getElementById('btn-finalizar');
        
        if (btnIniciar) {
            btnIniciar.addEventListener('click', () => this.iniciarJornada());
        }
        if (btnFinalizar) {
            btnFinalizar.addEventListener('click', () => this.finalizarJornada());
        }
        
        // Controles de mes
        const btnMesAnterior = document.getElementById('btn-mes-anterior');
        const btnMesSiguiente = document.getElementById('btn-mes-siguiente');
        
        if (btnMesAnterior) {
            btnMesAnterior.addEventListener('click', () => this.cambiarMes(-1));
        }
        if (btnMesSiguiente) {
            btnMesSiguiente.addEventListener('click', () => this.cambiarMes(1));
        }
        
        // Exportar PDF
        const btnExportarPdf = document.getElementById('btn-exportar-pdf');
        if (btnExportarPdf) {
            btnExportarPdf.addEventListener('click', () => this.exportarPDF());
        }
        
        // Modal
        const formEditar = document.getElementById('form-editar');
        const btnCancelarEditar = document.getElementById('btn-cancelar-editar');
        const closeModal = document.querySelector('.close');
        
        if (formEditar) {
            formEditar.addEventListener('submit', (e) => this.guardarEdicion(e));
        }
        if (btnCancelarEditar) {
            btnCancelarEditar.addEventListener('click', () => this.cerrarModal());
        }
        if (closeModal) {
            closeModal.addEventListener('click', () => this.cerrarModal());
        }
        
        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-editar')) {
                this.cerrarModal();
            }
        });
    }

    async iniciarJornada() {
        const ahora = new Date();
        const fecha = ahora.toISOString().split('T')[0];
        const hora = ahora.toTimeString().slice(0, 5);
        
        this.jornadaActiva = {
            fecha: fecha,
            horaInicio: hora,
            timestamp: ahora.getTime()
        };
        
        await this.guardarJornadaActiva();
        this.actualizarEstadoJornada();
        
        // Mostrar notificación
        this.mostrarNotificacion('Jornada iniciada correctamente', 'success');
    }

    async finalizarJornada() {
        if (!this.jornadaActiva) return;
        
        const ahora = new Date();
        const horaFin = ahora.toTimeString().slice(0, 5);
        
        // Calcular horas trabajadas
        const horasTrabajadas = this.calcularHorasTrabajadas(
            this.jornadaActiva.horaInicio,
            horaFin
        );
        
        // Crear registro
        const registro = {
            id: Date.now().toString(),
            fecha: this.jornadaActiva.fecha,
            horaInicio: this.jornadaActiva.horaInicio,
            horaFin: horaFin,
            horasTrabajadas: horasTrabajadas,
            timestamp: ahora.getTime()
        };
        
        try {
            // Guardar en Supabase
            const registroGuardado = await this.guardarRegistro(registro);
            // Transformar datos al formato del frontend
            const registroParaFrontend = {
                id: registroGuardado.id,
                fecha: registroGuardado.fecha,
                horaInicio: registro.horaInicio,
                horaFin: registro.horaFin,
                horasTrabajadas: registro.horasTrabajadas,
                timestamp: registro.timestamp
            };
            this.registros.unshift(registroParaFrontend);
            
            // Limpiar jornada activa
            this.jornadaActiva = null;
            await this.guardarJornadaActiva();
            
            // Actualizar interfaz
            this.actualizarEstadoJornada();
            this.actualizarRegistrosMensuales();
            
            // Mostrar notificación
            this.mostrarNotificacion('Jornada finalizada correctamente', 'success');
        } catch (error) {
            console.error('Error finalizando jornada:', error);
            this.mostrarNotificacion('Error finalizando jornada', 'error');
        }
    }

    calcularHorasTrabajadas(horaInicio, horaFin) {
        const [inicioHoras, inicioMinutos] = horaInicio.split(':').map(Number);
        const [finHoras, finMinutos] = horaFin.split(':').map(Number);
        
        const inicioTotalMinutos = inicioHoras * 60 + inicioMinutos;
        const finTotalMinutos = finHoras * 60 + finMinutos;
        
        let diferenciaMinutos = finTotalMinutos - inicioTotalMinutos;
        
        // Si la jornada pasa medianoche
        if (diferenciaMinutos < 0) {
            diferenciaMinutos += 24 * 60;
        }
        
        const horas = Math.floor(diferenciaMinutos / 60);
        const minutos = diferenciaMinutos % 60;
        
        return `${horas}h ${minutos}m`;
    }

    actualizarEstadoJornada() {
        const estadoDiv = document.getElementById('estado-jornada');
        const btnIniciar = document.getElementById('btn-iniciar');
        const btnFinalizar = document.getElementById('btn-finalizar');
        
        if (!estadoDiv || !btnIniciar || !btnFinalizar) return;
        
        if (this.jornadaActiva) {
            estadoDiv.innerHTML = `
                <p class="estado-activo">
                    <strong>Jornada activa</strong><br>
                    Iniciada: ${this.jornadaActiva.fecha} ${this.jornadaActiva.horaInicio}
                </p>
            `;
            btnIniciar.disabled = true;
            btnFinalizar.disabled = false;
        } else {
            estadoDiv.innerHTML = '<p class="estado-inactivo">No hay jornada activa</p>';
            btnIniciar.disabled = false;
            btnFinalizar.disabled = true;
        }
    }

    cambiarMes(direccion) {
        this.mesActual.setMonth(this.mesActual.getMonth() + direccion);
        this.actualizarRegistrosMensuales();
    }

    actualizarRegistrosMensuales() {
        // Actualizar título del mes
        const mesSpan = document.getElementById('mes-actual');
        if (!mesSpan) return;
        
        const opciones = { year: 'numeric', month: 'long' };
        mesSpan.textContent = this.mesActual.toLocaleDateString('es-ES', opciones);
        
        // Filtrar registros del mes actual
        const registrosMes = this.obtenerRegistrosMes(this.mesActual);
        
        // Actualizar tabla
        this.actualizarTabla(registrosMes);
        
        // Actualizar total de horas
        this.actualizarTotalHoras(registrosMes);
    }

    obtenerRegistrosMes(fecha) {
        const año = fecha.getFullYear();
        const mes = fecha.getMonth();
        
        return this.registros.filter(registro => {
            const registroFecha = new Date(registro.fecha + 'T00:00:00');
            return registroFecha.getFullYear() === año && registroFecha.getMonth() === mes;
        }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    actualizarTabla(registros) {
        const container = document.getElementById('registros-container');
        const sinRegistros = document.getElementById('sin-registros');
        
        if (!container || !sinRegistros) return;
        
        container.innerHTML = '';
        
        if (registros.length === 0) {
            container.style.display = 'none';
            sinRegistros.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        sinRegistros.style.display = 'none';
        
        registros.forEach(registro => {
            const item = document.createElement('div');
            item.className = 'registro-item';
            item.dataset.id = registro.id;
            
            item.innerHTML = `
                <div class="registro-header">
                    <div class="registro-fecha">${this.formatearFecha(registro.fecha)}</div>
                    <div class="registro-horas">${registro.horasTrabajadas}</div>
                </div>
                <div class="registro-detalles">
                    <div class="registro-hora">
                        <div class="registro-hora-label">Inicio</div>
                        <div class="registro-hora-valor">${registro.horaInicio}</div>
                    </div>
                    <div class="registro-hora">
                        <div class="registro-hora-label">Fin</div>
                        <div class="registro-hora-valor">${registro.horaFin}</div>
                    </div>
                </div>
                <div class="registro-delete" onclick="app.eliminarRegistro('${registro.id}')">
                    <span>Eliminar</span>
                </div>
            `;
            
            // Click para editar
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.registro-delete')) {
                    this.editarRegistro(registro.id);
                }
            });
            
            // Agregar funcionalidad de swipe
            this.agregarSwipeFuncionalidad(item);
            
            container.appendChild(item);
        });
    }

    agregarSwipeFuncionalidad(elemento) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        const threshold = 80;
        
        const handleStart = (e) => {
            isDragging = true;
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            elemento.classList.add('swiping');
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const diffX = currentX - startX;
            
            if (diffX < 0) {
                const translateX = Math.max(diffX, -threshold);
                elemento.style.transform = `translateX(${translateX}px)`;
            }
        };
        
        const handleEnd = () => {
            if (!isDragging) return;
            
            isDragging = false;
            elemento.classList.remove('swiping');
            
            const diffX = currentX - startX;
            
            if (Math.abs(diffX) > threshold / 2) {
                elemento.classList.add('swiped');
                elemento.style.transform = 'translateX(-80px)';
            } else {
                elemento.style.transform = 'translateX(0)';
            }
        };
        
        // Eventos para mouse
        elemento.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        
        // Eventos para touch
        elemento.addEventListener('touchstart', handleStart);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
        
        // Click fuera para cerrar swipe
        document.addEventListener('click', (e) => {
            if (!elemento.contains(e.target)) {
                elemento.classList.remove('swiped');
                elemento.style.transform = 'translateX(0)';
            }
        });
    }

    actualizarTotalHoras(registros) {
        const totalHorasElement = document.getElementById('total-horas-mes');
        if (!totalHorasElement) return;
        
        const totalMinutos = registros.reduce((total, registro) => {
            if (!registro.horasTrabajadas) return total;
            const match = registro.horasTrabajadas.match(/(\d+)h (\d+)m/);
            if (match) {
                const horas = parseInt(match[1]);
                const minutos = parseInt(match[2]);
                return total + (horas * 60 + minutos);
            }
            return total;
        }, 0);
        
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        
        totalHorasElement.textContent = `${horas}h ${minutos}m`;
    }

    formatearFecha(fechaString) {
        const fecha = new Date(fechaString + 'T00:00:00');
        const opciones = { day: '2-digit', month: '2-digit', year: 'numeric' };
        return fecha.toLocaleDateString('es-ES', opciones);
    }

    editarRegistro(id) {
        const registro = this.registros.find(r => r.id === id);
        if (!registro) return;
        
        this.editandoId = id;
        
        // Llenar formulario
        document.getElementById('editar-fecha').value = registro.fecha;
        document.getElementById('editar-hora-inicio').value = registro.horaInicio;
        document.getElementById('editar-hora-fin').value = registro.horaFin;
        
        // Mostrar modal
        document.getElementById('modal-editar').style.display = 'block';
    }

    async guardarEdicion(e) {
        e.preventDefault();
        
        const registro = this.registros.find(r => r.id === this.editandoId);
        if (!registro) return;
        
        // Actualizar datos
        registro.fecha = document.getElementById('editar-fecha').value;
        registro.horaInicio = document.getElementById('editar-hora-inicio').value;
        registro.horaFin = document.getElementById('editar-hora-fin').value;
        registro.horasTrabajadas = this.calcularHorasTrabajadas(
            registro.horaInicio,
            registro.horaFin
        );
        
        // Guardar cambios en Supabase
        try {
            const { error } = await this.supabase
                .from('registros_turnos')
                .update({
                    fecha: registro.fecha,
                    hora_inicio: registro.horaInicio,
                    hora_fin: registro.horaFin,
                    horas_trabajadas: registro.horasTrabajadas
                })
                .eq('id', registro.id);
            
            if (error) throw error;
            
            this.actualizarRegistrosMensuales();
            this.cerrarModal();
            
            this.mostrarNotificacion('Registro actualizado correctamente', 'success');
        } catch (error) {
            console.error('Error actualizando registro:', error);
            this.mostrarNotificacion('Error actualizando registro', 'error');
        }
    }

    async eliminarRegistro(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;
        
        try {
            // Eliminar de Supabase
            const { error } = await this.supabase
                .from('registros_turnos')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Eliminar de memoria
            this.registros = this.registros.filter(r => r.id !== id);
            this.actualizarRegistrosMensuales();
            
            this.mostrarNotificacion('Registro eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error eliminando registro:', error);
            this.mostrarNotificacion('Error eliminando registro', 'error');
        }
    }

    cerrarModal() {
        const modal = document.getElementById('modal-editar');
        if (modal) {
            modal.style.display = 'none';
        }
        this.editandoId = null;
    }

    exportarPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF no está cargado');
            this.mostrarNotificacion('Error: librería PDF no disponible', 'error');
            return;
        }
        const doc = new jsPDF();
        
        // Configuración
        doc.setFont('helvetica');
        doc.setFontSize(20);
        doc.text('Registro de Turnos de Trabajo', 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        const mesTexto = this.mesActual.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        doc.text(`Mes: ${mesTexto}`, 105, 30, { align: 'center' });
        
        // Obtener datos
        const registros = this.obtenerRegistrosMes(this.mesActual);
        
        if (registros.length === 0) {
            doc.setFontSize(12);
            doc.text('No hay registros para este mes', 105, 50, { align: 'center' });
        } else {
            // Preparar datos para la tabla
            const datosTabla = registros.map(registro => [
                this.formatearFecha(registro.fecha),
                registro.horaInicio,
                registro.horaFin,
                registro.horasTrabajadas
            ]);
            
            // Crear tabla
            doc.autoTable({
                head: [['Fecha', 'Hora Inicio', 'Hora Fin', 'Horas Trabajadas']],
                body: datosTabla,
                startY: 40,
                theme: 'grid',
                styles: { fontSize: 10 },
                headStyles: { fillColor: [66, 153, 225], textColor: 255 }
            });
            
            // Total de horas
            const totalMinutos = registros.reduce((total, registro) => {
                if (!registro.horasTrabajadas) return total;
                const match = registro.horasTrabajadas.match(/(\d+)h (\d+)m/);
                if (match) {
                    const horas = parseInt(match[1]);
                    const minutos = parseInt(match[2]);
                    return total + (horas * 60 + minutos);
                }
                return total;
            }, 0);
            
            const horas = Math.floor(totalMinutos / 60);
            const minutos = totalMinutos % 60;
            
            const finalY = doc.lastAutoTable.finalY || 40;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total horas trabajadas: ${horas}h ${minutos}m`, 105, finalY + 10, { align: 'center' });
        }
        
        // Descargar PDF
        const nombreArchivo = `registros-turnos-${mesTexto.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        doc.save(nombreArchivo);
        
        this.mostrarNotificacion('PDF exportado correctamente', 'success');
    }

    async guardarJornadaActiva() {
        try {
            if (this.jornadaActiva) {
                // Guardar jornada activa en Supabase
                const { error } = await this.supabase
                    .from('jornadas_activas')
                    .upsert({
                        user_id: this.userId,
                        fecha: this.jornadaActiva.fecha,
                        hora_inicio: this.jornadaActiva.horaInicio,
                        timestamp: new Date(this.jornadaActiva.timestamp).toISOString().slice(0, -1)
                    }, {
                        onConflict: 'user_id'
                    });
                
                if (error) throw error;
            } else {
                // Eliminar jornada activa de Supabase
                const { error } = await this.supabase
                    .from('jornadas_activas')
                    .delete()
                    .eq('user_id', this.userId);
                
                if (error) console.error('Error eliminando jornada activa:', error);
            }
        } catch (error) {
            console.error('Error guardando jornada activa:', error);
        }
    }

    async cargarJornadaActiva() {
        try {
            if (!this.userId) return;
            
            // Cargar jornada activa desde Supabase
            const { data, error } = await this.supabase
                .from('jornadas_activas')
                .select('*')
                .eq('user_id', this.userId)
                .single();
            
            if (error && error.code !== 'PGRST116') {
                console.error('Error cargando jornada activa:', error);
                return;
            }
            
            if (data) {
                // Verificar si la jornada es del mismo día (para no cargar jornadas antiguas)
                const hoy = new Date().toISOString().split('T')[0];
                if (data.fecha === hoy) {
                    this.jornadaActiva = {
                        fecha: data.fecha,
                        horaInicio: data.hora_inicio,
                        timestamp: data.timestamp
                    };
                } else {
                    // Si es de otro día, eliminarla automáticamente
                    await this.supabase
                        .from('jornadas_activas')
                        .delete()
                        .eq('user_id', this.userId);
                }
            }
        } catch (error) {
            console.error('Error cargando jornada activa:', error);
        }
    }

    async guardarRegistro(registro) {
        try {
            // Guardar en Supabase
            const { data, error } = await this.supabase
                .from('registros_turnos')
                .insert([{
                    id: registro.id,
                    user_id: this.userId,
                    fecha: registro.fecha,
                    hora_inicio: registro.horaInicio,
                    hora_fin: registro.horaFin,
                    horas_trabajadas: registro.horasTrabajadas
                }])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error guardando registro:', error);
            throw error;
        }
    }

    async cargarRegistros() {
        try {
            if (!this.userId) return;
            
            // Cargar desde Supabase
            const { data, error } = await this.supabase
                .from('registros_turnos')
                .select('*')
                .eq('user_id', this.userId)
                .order('fecha', { ascending: false });
            
            if (error) throw error;
            
            // Transformar datos al formato esperado
            this.registros = data.map(registro => ({
                id: registro.id,
                fecha: registro.fecha,
                horaInicio: registro.hora_inicio,
                horaFin: registro.hora_fin,
                horasTrabajadas: registro.horas_trabajadas,
                timestamp: registro.created_at
            }));
        } catch (error) {
            console.error('Error cargando registros:', error);
            this.registros = [];
        }
    }

    mostrarNotificacion(mensaje, tipo) {
        // Crear elemento de notificación
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo}`;
        notificacion.textContent = mensaje;
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${tipo === 'success' ? '#48bb78' : '#f56565'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 600;
            animation: slideInRight 0.3s ease;
        `;
        
        // Añadir animación
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        if (!document.head.querySelector('style[data-notification]')) {
            style.setAttribute('data-notification', 'true');
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notificacion);
        
        // Eliminar después de 3 segundos
        setTimeout(() => {
            notificacion.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (notificacion.parentNode) {
                    notificacion.parentNode.removeChild(notificacion);
                }
            }, 300);
        }, 3000);
    }

}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RegistroTurnos();
});

// Función global para switchTab (usada en onclick del HTML)
function switchTab(tab) {
    if (window.app) {
        window.app.switchTab(tab);
    }
}

// Función global para exportar PDF (usada en onclick del HTML)
function exportarPDF() {
    if (window.app) {
        window.app.exportarPDF();
    }
}