const obtenerLema = (doc) => {
    const enlace = doc.querySelector(
        'dl:has(> dt) > dd > a[href*="/wiki/"]'
    )

    if (!enlace)
        return null

    const ruta = enlace.getAttribute('href').split('#')[0]
    const palabra = ruta.split('/').pop()

    return decodeURIComponent(palabra).replaceAll('_', ' ')
}
const wiktionarySpanish = (word, lemaOriginal = null, descripcion = null) => {
    document.body.dataset.state = 'loading'

    const url = 'https://es.wiktionary.org/w/api.php'

    const params = new URLSearchParams({
        action: 'parse',
        page: word,
        prop: 'text',
        format: 'json',
        origin: '*'
    })

    return fetch(url + '?' + params.toString())
        .then(response => {
            if (!response.ok)
                throw new Error('Error HTTP: ' + response.status)

            return response.json()
        })
        .then(data => {
            if (data.error || !data.parse?.text?.['*'])
                throw new Error('No se encontraron definiciones')

            const html = data.parse.text['*']

            const doc = new DOMParser()
                .parseFromString(html, 'text/html')

            const encabezado = doc.querySelector('h2#Español')

            if (!encabezado)
                throw new Error('No existe una sección en español')

            const categorias = new Map()
            let categoriaActual = null

            let elemento = encabezado.parentElement.nextElementSibling

            while (elemento) {
                // Detenerse al llegar al siguiente idioma
                if (elemento.matches('.mw-heading2'))
                    break

                // Identificar la categoría gramatical
                if (elemento.matches('.mw-heading3, .mw-heading4')) {
                    const titulo = elemento.querySelector('h3, h4')?.textContent.trim()

                    if (/^(Sustantivo|Verbo|Adjetivo|Adverbio|Interjección|Forma verbal|Forma sustantiva|Forma adjetiva)/i.test(titulo ?? '')) {
                        categoriaActual = titulo

                        if (!categorias.has(titulo))
                            categorias.set(titulo, [])
                    } else {
                        categoriaActual = null
                    }
                }

                // Recoger las definiciones
                if (categoriaActual) {
                    const definiciones = elemento.matches('dl:has(> dt)')
                        ? [elemento]
                        : elemento.querySelectorAll('dl:has(> dt)')

                    for (const dl of definiciones) {
                        for (const dd of dl.querySelectorAll(':scope > dd')) {
                            const copia = dd.cloneNode(true)

                            copia.querySelectorAll('style, script').forEach(
                                nodo => nodo.remove()
                            )

                            categorias.get(categoriaActual).push(
                                copia.textContent.trim()
                            )
                        }
                    }
                }

                elemento = elemento.nextElementSibling
            }

            const tieneDefinicionesPropias = [...categorias].some(
                ([categoria, definiciones]) =>
                    !categoria.startsWith('Forma ') &&
                    definiciones.length > 0
            )

            if (!lemaOriginal && !tieneDefinicionesPropias) {
                const lema = obtenerLema(doc)

                if (lema && lema.toLocaleLowerCase('es') !== word.toLocaleLowerCase('es')) {
                    const definicion = doc.querySelector(
                        'dl:has(> dt) > dd:has(> span.definicion-impropia)'
                    )

                    let descripcionGramatical = null

                    if (definicion) {
                        const copia = definicion.cloneNode(true)

                        copia.querySelectorAll('style, script').forEach(
                            elemento => elemento.remove()
                        )

                        descripcionGramatical = copia.textContent
                            .trim()
                            .replace(/\s+/g, ' ')
                    }

                    main.replaceChildren()
                    return wiktionarySpanish(lema, word, descripcionGramatical)
                }
            }

            if (![...categorias.values()].some(definiciones => definiciones.length))
                throw new Error('No se encontraron definiciones en español')


            const hgroup = document.createElement('hgroup')

            const h1 = document.createElement('h1')
            h1.innerText = lemaOriginal ?? word

            const p = document.createElement('p')
            p.innerText = lemaOriginal
                ? (descripcion || 'Forma de ' + word)
                : 'Español'

            hgroup.append(h1, p)
            main.append(hgroup)

            if (lemaOriginal) {
                const h2 = document.createElement('h2')
                h2.innerText = word
                main.append(h2)
            }

            for (const [categoria, definiciones] of categorias) {
                if (!definiciones.length)
                    continue

                const h2 = document.createElement('h2')
                h2.innerText = categoria

                const ol = document.createElement('ol')

                for (const definicion of definiciones) {
                    const li = document.createElement('li')
                    li.innerText = definicion
                    ol.append(li)
                }

                main.append(h2, ol)
            }

            document.querySelector('#link').href =
                'https://es.wiktionary.org/wiki/' + encodeURIComponent(word)

            document.body.dataset.state = 'loaded'

        })
        .catch(error => {
        console.error('Error en Wikcionario español:', error)

        main.replaceChildren()

        const mensaje = document.createElement('p')
        mensaje.textContent = error.message === 'No se encontraron definiciones' ||
            error.message === 'No existe una sección en español' ||
            error.message === 'No se encontraron definiciones en español'
            ? 'Palabra «' + word + '» no encontrada en Wikcionario'
            : 'No se ha podido consultar Wikcionario'

        main.append(mensaje)
        document.body.dataset.state = 'loaded'
        })
    }
