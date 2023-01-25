// ==UserScript==
// @id           wayfarer-planner@NvlblNm
// @name         IITC plugin: Wayfarer Planner
// @category     Layer
// @version      1.170
// @namespace    https://gitlab.com/NvlblNm/wayfarer/
// @downloadURL  https://gitlab.com/NvlblNm/wayfarer/raw/master/wayfarer-planner.user.js
// @homepageURL  https://gitlab.com/NvlblNm/wayfarer/
// @description  Place markers on the map for your candidates in Wayfarer.
// @match        https://intel.ingress.com/*
// @grant none
// ==/UserScript==
/* forked from https://github.com/Wintervorst/iitc/raw/master/plugins/totalrecon/ */

/* eslint-env es6 */
/* eslint no-var: "error" */
/* globals L, map */
/* globals GM_info, $, dialog */

function wrapper(pluginInfo) {
    // eslint-disable-line no-extra-semi
    'use strict'

    // PLUGIN START ///////////////////////////////////////////////////////

    let editmarker = null
    let isPlacingMarkers = false

    let markercollection = []
    let plottedmarkers = {}
    let plottedtitles = {}
    let plottedsubmitrange = {}
    let plottedinteractrange = {}
    let plottedcells = {}

    // Define the layers created by the plugin, one for each marker status
    const mapLayers = {
        potential: {
            color: 'grey',
            title: 'Potentials',
            optionTitle: 'Potential'
        },
        held: {
            color: 'yellow',
            title: 'On hold',
            optionTitle: 'On hold'
        },
        submitted: {
            color: 'orange',
            title: 'Submitted',
            optionTitle: 'Submitted'
        },
        voting: {
            color: 'brown',
            title: 'Voting',
            optionTitle: 'Voting'
        },
        NIANTIC_REVIEW: {
            color: 'pink',
            title: 'Niantic Review',
            optionTitle: 'Niantic Review'
        },
        live: {
            color: 'green',
            title: 'Accepted',
            optionTitle: 'Live'
        },
        rejected: {
            color: 'red',
            title: 'Rejected',
            optionTitle: 'Rejected'
        },
        appealed: {
            color: 'black',
            title: 'Appealed',
            optionTitle: 'Appealed'
        },
        potentialedit: {
            color: 'cornflowerblue',
            title: 'Potential edit',
            optionTitle: 'Edit location. Potential'
        },
        sentedit: {
            color: 'purple',
            title: 'Sent edit',
            optionTitle: 'Edit location. Sent'
        }
    }

    const defaultSettings = {
        showTitles: true,
        showRadius: false,
        showInteractionRadius: false,
        showVotingProximity: false,
        scriptURL: '',
        disableDraggingMarkers: false,
        enableCoordinatesEdit: true,
        enableImagePreview: true
    }
    let settings = defaultSettings

    function saveSettings() {
        localStorage.wayfarer_planner_settings = JSON.stringify(settings)
    }

    function loadSettings() {
        const tmp = localStorage.wayfarer_planner_settings
        if (!tmp) {
            upgradeSettings()
            return
        }

        try {
            settings = JSON.parse(tmp)
        } catch (e) {
            // eslint-disable-line no-empty
        }
    }

    // importing from totalrecon_settings will be removed after a little while
    function upgradeSettings() {
        const tmp = localStorage.totalrecon_settings
        if (!tmp) {
            return
        }

        try {
            settings = JSON.parse(tmp)
        } catch (e) {
            // eslint-disable-line no-empty
        }
        saveSettings()
        localStorage.removeItem('totalrecon_settings')
    }

    function getStoredData() {
        const url = settings.scriptURL
        if (!url) {
            markercollection = []
            drawMarkers()
            return
        }

        $.ajax({
            url,
            type: 'GET',
            dataType: 'text',
            success: function (data, status, header) {
                try {
                    markercollection = JSON.parse(data)
                } catch (e) {
                    console.log(
                        'Wayfarer Planner. Exception parsing response: ',
                        e
                    ) // eslint-disable-line no-console
                    alert('Wayfarer Planner. Exception parsing response.')
                    return
                }
                drawMarkers()
            },
            error: function (x, y, z) {
                console.log('Wayfarer Planner. Error message: ', x, y, z) // eslint-disable-line no-console
                alert(
                    "Wayfarer Planner. Failed to retrieve data from the scriptURL.\r\nVerify that you're using the right URL and that you don't use any extension that blocks access to google."
                )
            }
        })
    }

    function drawMarker(candidate) {
        if (
            candidate !== undefined &&
            candidate.lat !== '' &&
            candidate.lng !== ''
        ) {
            addMarkerToLayer(candidate)
            addTitleToLayer(candidate)
            addCircleToLayer(candidate)
            addVotingProximity(candidate)
        }
    }

    function addCircleToLayer(candidate) {
        if (settings.showRadius) {
            const latlng = L.latLng(candidate.lat, candidate.lng)

            // Specify the no submit circle options
            const circleOptions = {
                color: 'black',
                opacity: 1,
                fillColor: 'grey',
                fillOpacity: 0.4,
                weight: 1,
                clickable: false,
                interactive: false
            }
            const range = 20 // Hardcoded to 20m, the universal too close for new submit range of a portal

            // Create the circle object with specified options
            const circle = new L.Circle(latlng, range, circleOptions)
            // Add the new circle
            const existingMarker = plottedmarkers[candidate.id]
            existingMarker.layer.addLayer(circle)

            plottedsubmitrange[candidate.id] = circle
        }
        if (settings.showInteractionRadius) {
            const latlng = L.latLng(candidate.lat, candidate.lng)

            // Specify the interaction circle options
            const circleOptions = {
                color: 'grey',
                opacity: 1,
                fillOpacity: 0,
                weight: 1,
                clickable: false,
                interactive: false
            }
            const range = 80

            // Create the circle object with specified options
            const circle = new L.Circle(latlng, range, circleOptions)
            // Add the new circle
            const existingMarker = plottedmarkers[candidate.id]
            existingMarker.layer.addLayer(circle)

            plottedinteractrange[candidate.id] = circle
        }
    }

    function removeExistingCircle(guid) {
        const existingCircle = plottedsubmitrange[guid]
        if (existingCircle !== undefined) {
            const existingMarker = plottedmarkers[guid]
            existingMarker.layer.removeLayer(existingCircle)
            delete plottedsubmitrange[guid]
        }
        const existingInteractCircle = plottedinteractrange[guid]
        if (existingInteractCircle !== undefined) {
            const existingMarker = plottedmarkers[guid]
            existingMarker.layer.removeLayer(existingInteractCircle)
            delete plottedinteractrange[guid]
        }
    }

    function addTitleToLayer(candidate) {
        if (settings.showTitles) {
            const title = candidate.title
            if (title !== '') {
                const portalLatLng = L.latLng(candidate.lat, candidate.lng)
                const titleMarker = L.marker(portalLatLng, {
                    icon: L.divIcon({
                        className: 'wayfarer-planner-name',
                        iconAnchor: [100, 5],
                        iconSize: [200, 10],
                        html: title
                    }),
                    data: candidate
                })
                const existingMarker = plottedmarkers[candidate.id]
                existingMarker.layer.addLayer(titleMarker)

                plottedtitles[candidate.id] = titleMarker
            }
        }
    }

    function removeExistingTitle(guid) {
        const existingTitle = plottedtitles[guid]
        if (existingTitle !== undefined) {
            const existingMarker = plottedmarkers[guid]
            existingMarker.layer.removeLayer(existingTitle)
            delete plottedtitles[guid]
        }
    }

    function addVotingProximity(candidate) {
        if (settings.showVotingProximity && candidate.status === 'voting') {
            const cell = S2.S2Cell.FromLatLng(
                { lat: candidate.lat, lng: candidate.lng },
                17
            )
            const surrounding = cell.getSurrounding()
            surrounding.push(cell)

            for (let i = 0; i < surrounding.length; i++) {
                const cellId = surrounding[i].toString()
                if (!plottedcells[cellId]) {
                    plottedcells[cellId] = { candidateIds: [], polygon: null }
                    const vertexes = surrounding[i].getCornerLatLngs()
                    const polygon = L.polygon(vertexes, {
                        color: 'black',
                        opacity: 0.5,
                        fillColor: 'orange',
                        fillOpacity: 0.3
                    })
                    plottedcells[cellId].polygon = polygon
                    polygon.addTo(map)
                }
                if (
                    plottedcells[cellId].candidateIds.indexOf(candidate.id) ===
                    -1
                ) {
                    plottedcells[cellId].candidateIds.push(candidate.id)
                }
            }
        }
    }

    function removeExistingVotingProximity(guid) {
        Object.entries(plottedcells).forEach(
            ([cellId, { candidateIds, polygon }]) => {
                plottedcells[cellId].candidateIds = candidateIds.filter(
                    (id) => id !== guid
                )
                if (plottedcells[cellId].candidateIds.length === 0) {
                    map.removeLayer(polygon)
                    delete plottedcells[cellId]
                }
            }
        )
    }

    function removeExistingMarker(guid) {
        const existingMarker = plottedmarkers[guid]
        if (existingMarker !== undefined) {
            existingMarker.layer.removeLayer(existingMarker.marker)
            removeExistingTitle(guid)
            removeExistingCircle(guid)
            removeExistingVotingProximity(guid)
        }
    }

    function addMarkerToLayer(candidate) {
        removeExistingMarker(candidate.id)

        const portalLatLng = L.latLng(candidate.lat, candidate.lng)

        const layerData = mapLayers[candidate.status]
        const markerColor = layerData.color
        const markerLayer = layerData.layer
        let draggable = true
        if (settings.disableDraggingMarkers) {
            draggable = false
        }

        const marker = createGenericMarker(portalLatLng, markerColor, {
            title: candidate.title,
            id: candidate.id,
            data: candidate,
            draggable
        })

        marker.on('dragend', function (e) {
            const data = e.target.options.data
            const latlng = marker.getLatLng()
            data.lat = latlng.lat
            data.lng = latlng.lng

            drawInputPopop(latlng, data)
        })

        marker.on('dragstart', function (e) {
            const guid = e.target.options.data.id
            removeExistingTitle(guid)
            removeExistingCircle(guid)
        })

        markerLayer.addLayer(marker)
        plottedmarkers[candidate.id] = { marker, layer: markerLayer }
    }

    function clearAllLayers() {
        Object.values(mapLayers).forEach((data) => data.layer.clearLayers())
        Object.values(plottedcells).forEach((data) =>
            map.removeLayer(data.polygon)
        )

        /* clear marker storage */
        plottedmarkers = {}
        plottedtitles = {}
        plottedsubmitrange = {}
        plottedinteractrange = {}
        plottedcells = {}
    }

    function drawMarkers() {
        clearAllLayers()
        markercollection.forEach(drawMarker)
    }

    function onMapClick(e) {
        if (isPlacingMarkers) {
            if (editmarker != null) {
                map.removeLayer(editmarker)
            }

            const marker = createGenericMarker(e.latlng, 'pink', {
                title: 'Place your mark!'
            })

            editmarker = marker
            marker.addTo(map)

            drawInputPopop(e.latlng)
        }
    }

    function drawInputPopop(latlng, markerData) {
        const formpopup = L.popup()

        let title = ''
        let description = ''
        let id = ''
        let submitteddate = ''
        let lat = ''
        let lng = ''
        let status = 'potential'
        let imageUrl = ''

        if (markerData !== undefined) {
            id = markerData.id
            title = markerData.title
            description = markerData.description
            submitteddate = markerData.submitteddate
            status = markerData.status
            imageUrl = markerData.candidateimageurl
            lat = parseFloat(markerData.lat).toFixed(6)
            lng = parseFloat(markerData.lng).toFixed(6)
        } else {
            lat = latlng.lat.toFixed(6)
            lng = latlng.lng.toFixed(6)
        }

        formpopup.setLatLng(latlng)

        const options = Object.keys(mapLayers)
            .map(
                (id) =>
                    '<option value="' +
                    id +
                    '"' +
                    (id === status ? ' selected="selected"' : '') +
                    '>' +
                    mapLayers[id].optionTitle +
                    '</option>'
            )
            .join('')
        let coordinates = `<input name="lat" type="hidden" value="${lat}">
            <input name="lng" type="hidden" value="${lng}">`
        if (settings.enableCoordinatesEdit) {
            coordinates = `<label>Latitude
                <input name="lat" type="text" autocomplete="off" value="${lat}">
                </label>
                <label>Longitude
                <input name="lng" type="text" autocomplete="off" value="${lng}">
                </label>`
        }
        let image = ''
        let largeImageUrl = imageUrl
        if (
            largeImageUrl.includes('googleusercontent') &&
            !largeImageUrl.includes('=')
        ) {
            largeImageUrl += '=s0'
        }
        if (
            imageUrl !== '' &&
            imageUrl !== undefined &&
            settings.enableImagePreview
        ) {
            image = `<a href="${largeImageUrl}" target="_blank" class="imagePreviewContainer"><img class="imagePreview" src="${imageUrl}"></a>`
        }

        let formContent = `<div class="wayfarer-planner-popup"><form id="submit-to-wayfarer">
            <label>Status
            <select name="status">${options}</select>
            </label>
            <label>Title
            <input name="title" type="text" autocomplete="off" placeholder="Title (required)" required value="${title}">
            </label>
            <label>Description
            <input name="description" type="text" autocomplete="off" placeholder="Description" value="${description}">
            </label>
            ${image}
            <div class='wayfarer-expander' title='Click to expand additional fields'>»</div>
            <div class='wayfarer-extraData'>
            ${coordinates}
            <label>Submitted date
            <input name="submitteddate" type="text" autocomplete="off" placeholder="dd-mm-jjjj" value="${submitteddate}">
            </label>
            <label>Image URL
            <input name="candidateimageurl" type="text" autocomplete="off" placeholder="http://?.googleusercontent.com/***" value="${imageUrl}">
            </label>
            </div>
            <input name="id" type="hidden" value="${id}">
            <input name="nickname" type="hidden" value="${window.PLAYER.nickname}">
            <button type="submit" id='wayfarer-submit'>Send</button>
            </form>`

        if (id !== '') {
            formContent +=
                '<a style="padding:4px; display: inline-block;" id="deletePortalCandidate">Delete 🗑️</a>'
        }

        if (
            imageUrl !== '' &&
            imageUrl !== undefined &&
            !settings.enableImagePreview
        ) {
            formContent +=
                ' <a href="' +
                largeImageUrl +
                '" style="padding:4px; float:right;" target="_blank">Image</a>'
        }
        const align =
            id !== ''
                ? 'float: right'
                : 'box-sizing: border-box; text-align: right; display: inline-block; width: 100%'
        formContent += ` <a href="https://www.google.com/maps?layer=c&cbll=${lat},${lng}" style="padding:4px; ${align};" target="_blank">Street View</a>`

        formpopup.setContent(formContent + '</div>')
        formpopup.openOn(map)

        const deleteLink = formpopup._contentNode.querySelector(
            '#deletePortalCandidate'
        )
        if (deleteLink != null) {
            deleteLink.addEventListener('click', (e) =>
                confirmDeleteCandidate(e, id)
            )
        }
        const expander =
            formpopup._contentNode.querySelector('.wayfarer-expander')
        expander.addEventListener('click', function () {
            expander.parentNode.classList.toggle('wayfarer__expanded')
        })
    }

    function confirmDeleteCandidate(e, id) {
        e.preventDefault()

        if (!confirm('Do you want to remove this candidate?')) {
            return
        }

        const formData = new FormData()
        formData.append('status', 'delete')
        formData.append('id', id)

        $.ajax({
            url: settings.scriptURL,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (data, status, header) {
                removeExistingMarker(id)
                for (let i = 0; i < markercollection.length; i++) {
                    if (markercollection[i].id === id) {
                        markercollection.splice(i, 1)
                        break
                    }
                }
                map.closePopup()
            },
            error: function (x, y, z) {
                console.log('Wayfarer Planner. Error message: ', x, y, z) // eslint-disable-line no-console
                alert('Wayfarer Planner. Failed to send data to the scriptURL')
            }
        })
    }

    function markerClicked(event) {
        // bind data to edit form
        if (editmarker != null) {
            map.removeLayer(editmarker)
            editmarker = null
        }
        drawInputPopop(event.layer.getLatLng(), event.layer.options.data)
    }

    function getGenericMarkerSvg(color) {
        const markerTemplate = `<?xml version="1.0" encoding="UTF-8"?>
            <svg xmlns="http://www.w3.org/2000/svg" baseProfile="full" viewBox="0 0 25 41">
                <path d="M19.4,3.1c-3.3-3.3-6.1-3.3-6.9-3.1c-0.6,0-3.7,0-6.9,3.1c-4,4-1.3,9.4-1.3,9.4s5.6,14.6,6.3,16.3c0.6,1.2,1.3,1.5,1.7,1.5c0,0,0,0,0.2,0h0.2c0.4,0,1.2-0.4,1.7-1.5c0.8-1.7,6.3-16.3,6.3-16.3S23.5,7.2,19.4,3.1z M13.1,12.4c-2.3,0.4-4.4-1.5-4-4c0.2-1.3,1.3-2.5,2.9-2.9c2.3-0.4,4.4,1.5,4,4C15.6,11,14.4,12.2,13.1,12.4z" fill="%COLOR%" stroke="#fff"/>
                <path d="M12.5,34.1c1.9,0,3.5,1.5,3.5,3.5c0,1.9-1.5,3.5-3.5,3.5S9,39.5,9,37.5c0-1.2,0.6-2.2,1.5-2.9 C11.1,34.3,11.8,34.1,12.5,34.1z" fill="%COLOR%" stroke="#fff"/>
            </svg>`

        return markerTemplate.replace(/%COLOR%/g, color)
    }

    function getGenericMarkerIcon(color, className) {
        return L.divIcon({
            iconSize: new L.Point(25, 41),
            iconAnchor: new L.Point(12, 41),
            html: getGenericMarkerSvg(color),
            className: className || 'leaflet-iitc-divicon-generic-marker'
        })
    }

    function createGenericMarker(ll, color, options) {
        options = options || {}

        const markerOpt = $.extend(
            {
                icon: getGenericMarkerIcon(color || '#a24ac3')
            },
            options
        )

        return L.marker(ll, markerOpt)
    }

    function showDialog() {
        if (window.isSmartphone()) {
            window.show('map')
        }

        const html = `<p><label for="txtScriptUrl">Url for the script</label><br><input type="url" id="txtScriptUrl" spellcheck="false" placeholder="https://script.google.com/macros/***/exec"></p>
             <p><a class='wayfarer-refresh'>Update candidate data</a></p>
             <p><input type="checkbox" id="chkShowTitles"><label for="chkShowTitles">Show titles</label></p>
             <p><input type="checkbox" id="chkShowRadius"><label for="chkShowRadius">Show submit radius</label></p>
             <p><input type="checkbox" id="chkShowInteractRadius"><label for="chkShowInteractRadius">Show interaction radius</label></p>
             <p><input type="checkbox" id="chkShowVotingProximity"><label for="chkShowVotingProximity">Show voting proximity</label></p>
             <p><input type="checkbox" id="chkDisableDraggingMarkers"><label for="chkDisableDraggingMarkers">Disable Dragging Markers</label></p>
             <p><input type="checkbox" id="chkEnableCoordinatesEdit"><label for="chkEnableCoordinatesEdit">Enable Coordinates Edit</label></p>
             <p><input type="checkbox" id="chkEnableImagePreview"><label for="chkEnableImagePreview">Enable Image Preview</label></p>
            `

        const container = dialog({
            width: 'auto',
            html,
            title: 'Wayfarer Planner',
            buttons: {
                OK: function () {
                    const newUrl = txtInput.value
                    if (!txtInput.reportValidity()) {
                        return
                    }

                    if (newUrl !== '') {
                        if (
                            !newUrl.startsWith(
                                'https://script.google.com/macros/'
                            )
                        ) {
                            alert(
                                'The URL of the script seems to be wrong, please paste the URL provided after "creating the webapp".'
                            )
                            return
                        }

                        if (
                            newUrl.includes('echo') ||
                            !newUrl.endsWith('exec')
                        ) {
                            alert(
                                'You must use the short URL provided by "creating the webapp", not the long one after executing the script.'
                            )
                            return
                        }
                        if (newUrl.includes(' ')) {
                            alert(
                                "Warning, the URL contains at least one space. Check that you've copied it properly."
                            )
                            return
                        }
                    }

                    if (newUrl !== settings.scriptURL) {
                        settings.scriptURL = newUrl
                        saveSettings()
                        getStoredData()
                    }

                    container.dialog('close')
                }
            }
        })

        const div = container[0]
        const txtInput = div.querySelector('#txtScriptUrl')
        txtInput.value = settings.scriptURL

        const linkRefresh = div.querySelector('.wayfarer-refresh')
        linkRefresh.addEventListener('click', () => {
            settings.scriptURL = txtInput.value
            saveSettings()
            getStoredData()
        })

        const chkShowTitles = div.querySelector('#chkShowTitles')
        chkShowTitles.checked = settings.showTitles

        chkShowTitles.addEventListener('change', (e) => {
            settings.showTitles = chkShowTitles.checked
            saveSettings()
            drawMarkers()
        })

        const chkShowRadius = div.querySelector('#chkShowRadius')
        chkShowRadius.checked = settings.showRadius
        chkShowRadius.addEventListener('change', (e) => {
            settings.showRadius = chkShowRadius.checked
            saveSettings()
            drawMarkers()
        })
        const chkShowInteractRadius = div.querySelector(
            '#chkShowInteractRadius'
        )
        chkShowInteractRadius.checked = settings.showInteractionRadius
        chkShowInteractRadius.addEventListener('change', (e) => {
            settings.showInteractionRadius = chkShowInteractRadius.checked
            saveSettings()
            drawMarkers()
        })
        const chkShowVotingProximity = div.querySelector(
            '#chkShowVotingProximity'
        )
        chkShowVotingProximity.checked = settings.showVotingProximity
        chkShowVotingProximity.addEventListener('change', (e) => {
            settings.showVotingProximity = chkShowVotingProximity.checked
            saveSettings()
            drawMarkers()
        })
        const chkDisableDraggingMarkers = div.querySelector(
            '#chkDisableDraggingMarkers'
        )
        chkDisableDraggingMarkers.checked = settings.disableDraggingMarkers
        chkDisableDraggingMarkers.addEventListener('change', (e) => {
            settings.disableDraggingMarkers = chkDisableDraggingMarkers.checked
            saveSettings()
            drawMarkers()
        })
        const chkEnableCoordinatesEdit = div.querySelector(
            '#chkEnableCoordinatesEdit'
        )
        chkEnableCoordinatesEdit.checked = settings.enableCoordinatesEdit
        chkEnableCoordinatesEdit.addEventListener('change', (e) => {
            settings.enableCoordinatesEdit = chkEnableCoordinatesEdit.checked
            saveSettings()
        })
        const chkEnableImagePreview = div.querySelector(
            '#chkEnableImagePreview'
        )
        chkEnableImagePreview.checked = settings.enableImagePreview
        chkEnableImagePreview.addEventListener('change', (e) => {
            settings.enableImagePreview = chkEnableImagePreview.checked
            saveSettings()
        })

        txtInput.addEventListener('input', (e) => {
            if (txtInput.value) {
                try {
                    new URL(txtInput.value) // eslint-disable-line no-new
                    if (
                        txtInput.value.startsWith(
                            'https://script.google.com/macros/'
                        )
                    ) {
                        $('.toggle-create-waypoints').show()
                        return
                    }
                } catch (error) {}
            }
            $('.toggle-create-waypoints').hide()
        })
    }

    // Initialize the plugin
    const setup = function () {
        loadSettings()

        $('<style>')
            .prop('type', 'text/css')
            .html(
                `
            .wayfarer-planner-popup {
                width:200px;
            }
            .wayfarer-planner-popup a {
                color: #ffce00;
            }
            .wayfarer-planner-name {
                font-size: 12px;
                font-weight: bold;
                color: gold;
                opacity: 0.7;
                text-align: center;
                text-shadow: -1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000, 0 0 2px #000;
                pointer-events: none;
            }
            #txtScriptUrl {
                width: 100%;
            }
            .wayfarer-planner__disabled {
                opacity: 0.8;
                pointer-events: none;
            }

            #submit-to-wayfarer {
                position: relative;
            }
            #submit-to-wayfarer input,
            #submit-to-wayfarer select {
                width: 100%;
            }
            #submit-to-wayfarer input {
                color: #CCC;
            }
            #submit-to-wayfarer label {
                margin-top: 5px;
                display: block;
                color: #fff;
            }
            #wayfarer-submit {
                height: 30px;
                margin-top: 10px;
                width: 100%;
            }

            .wayfarer-expander {
                cursor: pointer;
                transform: rotate(90deg) translate(-1px, 1px);
                transition: transform .2s ease-out 0s;
                position: absolute;
                right: 0;
            }

            .wayfarer-extraData {
                max-height: 0;
                overflow: hidden;
                margin-top: 1em;
            }

            .wayfarer__expanded .wayfarer-expander {
                transform: rotate(270deg) translate(1px, -3px);
            }

            .wayfarer__expanded .wayfarer-extraData {
                max-height: none;
                margin-top: 0em;
            }
            .toggle-create-waypoints{
                box-shadow: 0 0 5px;
                cursor:pointer;
                font-weight: bold;
                color: #000!important;
                background-color: #fff;
                border-bottom: 1px solid #ccc;
                width: 26px;
                height: 26px;
                line-height: 26px;
                display: block;
                text-align: center;
                text-decoration: none;
                border-radius: 4px;
                border-bottom: none;
            }
            .toggle-create-waypoints:hover{
                text-decoration:none;
            }
            .toggle-create-waypoints.active{
                background-color:#ffce00;
            }
            #submit-to-wayfarer .imagePreviewContainer{
                display:block;
                margin-top:5px;
                text-align:center;
            }
            #submit-to-wayfarer .imagePreview{
                max-width:100%;
                max-height:150px;
            }


            `
            )
            .appendTo('head')

        $('body').on('submit', '#submit-to-wayfarer', function (e) {
            e.preventDefault()
            map.closePopup()
            $.ajax({
                url: settings.scriptURL,
                type: 'POST',
                data: new FormData(e.currentTarget),
                processData: false,
                contentType: false,
                success: function (data, status, header) {
                    drawMarker(data)
                    let markerAlreadyExists = false
                    for (let i = 0; i < markercollection.length; i++) {
                        if (markercollection[i].id === data.id) {
                            Object.assign(markercollection[i], data)
                            markerAlreadyExists = true
                            break
                        }
                    }
                    if (!markerAlreadyExists) {
                        markercollection.push(data)
                    }
                    if (editmarker != null) {
                        map.removeLayer(editmarker)
                        editmarker = null
                    }
                },
                error: function (x, y, z) {
                    console.log('Wayfarer Planner. Error message: ', x, y, z) // eslint-disable-line no-console
                    alert(
                        "Wayfarer Planner. Failed to send data to the scriptURL.\r\nVerify that you're using the right URL and that you don't use any extension that blocks access to google."
                    )
                }
            })
        })

        map.on('click', onMapClick)

        Object.values(mapLayers).forEach((data) => {
            const layer = new L.featureGroup()
            data.layer = layer
            window.addLayerGroup('Wayfarer - ' + data.title, layer, true)
            layer.on('click', markerClicked)
        })

        const toolbox = document.getElementById('toolbox')

        const toolboxLink = document.createElement('a')
        toolboxLink.textContent = 'Wayfarer'
        toolboxLink.title = 'Settings for Wayfarer Planner'
        toolboxLink.addEventListener('click', showDialog)
        toolbox.appendChild(toolboxLink)

        if (settings.scriptURL) {
            getStoredData()
        } else {
            showDialog()
        }
        L.Control.CreatePoints = L.Control.extend({
            onAdd: function (map) {
                const button = L.DomUtil.create('a')
                button.classList.add('toggle-create-waypoints')
                if (!settings.scriptURL) {
                    button.style.display = 'none'
                }

                button.href = '#'
                button.innerHTML = 'P+'
                return button
            },

            onRemove: function (map) {
                // Nothing to do here
            }
        })

        L.control.createpoints = function (opts) {
            return new L.Control.CreatePoints(opts)
        }

        L.control.createpoints({ position: 'topleft' }).addTo(map)
        $('.toggle-create-waypoints').on('click', function (e) {
            e.preventDefault()
            e.stopPropagation()
            $(this).toggleClass('active')
            isPlacingMarkers = !isPlacingMarkers
            if (!isPlacingMarkers && editmarker != null) {
                map.closePopup()
                map.removeLayer(editmarker)
                editmarker = null
            }
        })
    }

    /** S2 Geometry functions

     S2 extracted from Regions Plugin
     https:static.iitc.me/build/release/plugins/regions.user.js

     */

    const d2r = Math.PI / 180.0
    const r2d = 180.0 / Math.PI

    const S2 = {}

    function LatLngToXYZ(latLng) {
        const phi = latLng.lat * d2r
        const theta = latLng.lng * d2r
        const cosphi = Math.cos(phi)

        return [
            Math.cos(theta) * cosphi,
            Math.sin(theta) * cosphi,
            Math.sin(phi)
        ]
    }

    function XYZToLatLng(xyz) {
        const lat = Math.atan2(
            xyz[2],
            Math.sqrt(xyz[0] * xyz[0] + xyz[1] * xyz[1])
        )
        const lng = Math.atan2(xyz[1], xyz[0])

        return { lat: lat * r2d, lng: lng * r2d }
    }

    function largestAbsComponent(xyz) {
        const temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])]

        if (temp[0] > temp[1]) {
            if (temp[0] > temp[2]) {
                return 0
            }
            return 2
        }

        if (temp[1] > temp[2]) {
            return 1
        }

        return 2
    }

    function faceXYZToUV(face, xyz) {
        let u, v

        switch (face) {
            case 0:
                u = xyz[1] / xyz[0]
                v = xyz[2] / xyz[0]
                break
            case 1:
                u = -xyz[0] / xyz[1]
                v = xyz[2] / xyz[1]
                break
            case 2:
                u = -xyz[0] / xyz[2]
                v = -xyz[1] / xyz[2]
                break
            case 3:
                u = xyz[2] / xyz[0]
                v = xyz[1] / xyz[0]
                break
            case 4:
                u = xyz[2] / xyz[1]
                v = -xyz[0] / xyz[1]
                break
            case 5:
                u = -xyz[1] / xyz[2]
                v = -xyz[0] / xyz[2]
                break
            default:
                throw { error: 'Invalid face' }
        }

        return [u, v]
    }

    function XYZToFaceUV(xyz) {
        let face = largestAbsComponent(xyz)

        if (xyz[face] < 0) {
            face += 3
        }

        const uv = faceXYZToUV(face, xyz)

        return [face, uv]
    }

    function FaceUVToXYZ(face, uv) {
        const u = uv[0]
        const v = uv[1]

        switch (face) {
            case 0:
                return [1, u, v]
            case 1:
                return [-u, 1, v]
            case 2:
                return [-u, -v, 1]
            case 3:
                return [-1, -v, -u]
            case 4:
                return [v, -1, -u]
            case 5:
                return [v, u, -1]
            default:
                throw { error: 'Invalid face' }
        }
    }

    function STToUV(st) {
        const singleSTtoUV = function (st) {
            if (st >= 0.5) {
                return (1 / 3.0) * (4 * st * st - 1)
            }
            return (1 / 3.0) * (1 - 4 * (1 - st) * (1 - st))
        }

        return [singleSTtoUV(st[0]), singleSTtoUV(st[1])]
    }

    function UVToST(uv) {
        const singleUVtoST = function (uv) {
            if (uv >= 0) {
                return 0.5 * Math.sqrt(1 + 3 * uv)
            }
            return 1 - 0.5 * Math.sqrt(1 - 3 * uv)
        }

        return [singleUVtoST(uv[0]), singleUVtoST(uv[1])]
    }

    function STToIJ(st, order) {
        const maxSize = 1 << order

        const singleSTtoIJ = function (st) {
            const ij = Math.floor(st * maxSize)
            return Math.max(0, Math.min(maxSize - 1, ij))
        }

        return [singleSTtoIJ(st[0]), singleSTtoIJ(st[1])]
    }

    function IJToST(ij, order, offsets) {
        const maxSize = 1 << order

        return [(ij[0] + offsets[0]) / maxSize, (ij[1] + offsets[1]) / maxSize]
    }

    // S2Cell class
    S2.S2Cell = function () {}

    // static method to construct
    S2.S2Cell.FromLatLng = function (latLng, level) {
        const xyz = LatLngToXYZ(latLng)
        const faceuv = XYZToFaceUV(xyz)
        const st = UVToST(faceuv[1])
        const ij = STToIJ(st, level)

        return S2.S2Cell.FromFaceIJ(faceuv[0], ij, level)
    }

    S2.S2Cell.FromFaceIJ = function (face, ij, level) {
        const cell = new S2.S2Cell()
        cell.face = face
        cell.ij = ij
        cell.level = level

        return cell
    }

    S2.S2Cell.prototype.toString = function () {
        return (
            'F' +
            this.face +
            'ij[' +
            this.ij[0] +
            ',' +
            this.ij[1] +
            ']@' +
            this.level
        )
    }

    S2.S2Cell.prototype.getLatLng = function () {
        const st = IJToST(this.ij, this.level, [0.5, 0.5])
        const uv = STToUV(st)
        const xyz = FaceUVToXYZ(this.face, uv)

        return XYZToLatLng(xyz)
    }

    S2.S2Cell.prototype.getCornerLatLngs = function () {
        const offsets = [
            [0.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
            [1.0, 0.0]
        ]

        return offsets.map((offset) => {
            const st = IJToST(this.ij, this.level, offset)
            const uv = STToUV(st)
            const xyz = FaceUVToXYZ(this.face, uv)

            return XYZToLatLng(xyz)
        })
    }

    S2.S2Cell.prototype.getSurrounding = function (deltas) {
        const fromFaceIJWrap = function (face, ij, level) {
            const maxSize = 1 << level
            if (
                ij[0] >= 0 &&
                ij[1] >= 0 &&
                ij[0] < maxSize &&
                ij[1] < maxSize
            ) {
                // no wrapping out of bounds
                return S2.S2Cell.FromFaceIJ(face, ij, level)
            }

            // the new i,j are out of range.
            // with the assumption that they're only a little past the borders we can just take the points as
            // just beyond the cube face, project to XYZ, then re-create FaceUV from the XYZ vector
            let st = IJToST(ij, level, [0.5, 0.5])
            let uv = STToUV(st)
            const xyz = FaceUVToXYZ(face, uv)
            const faceuv = XYZToFaceUV(xyz)
            face = faceuv[0]
            uv = faceuv[1]
            st = UVToST(uv)
            ij = STToIJ(st, level)
            return S2.S2Cell.FromFaceIJ(face, ij, level)
        }

        const face = this.face
        const i = this.ij[0]
        const j = this.ij[1]
        const level = this.level

        if (!deltas) {
            deltas = [
                { a: -1, b: 0 },
                { a: 0, b: -1 },
                { a: 1, b: 0 },
                { a: 0, b: 1 },
                { a: -1, b: -1 },
                { a: 1, b: 1 },
                { a: -1, b: 1 },
                { a: 1, b: -1 }
            ]
        }
        return deltas.map(function (values) {
            return fromFaceIJWrap(face, [i + values.a, j + values.b], level)
        })
    }

    // PLUGIN END //////////////////////////////////////////////////////////

    setup.info = pluginInfo // add the script info data to the function as a property
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded) {
        setup()
    } else {
        if (!window.bootPlugins) {
            window.bootPlugins = []
        }
        window.bootPlugins.push(setup)
    }
}
// wrapper end

;(function () {
    const pluginInfo = {}
    if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
        pluginInfo.script = {
            version: GM_info.script.version,
            name: GM_info.script.name,
            description: GM_info.script.description
        }
    }

    // Greasemonkey. It will be quite hard to debug
    if (
        typeof unsafeWindow !== 'undefined' ||
        typeof GM_info === 'undefined' ||
        GM_info.scriptHandler !== 'Tampermonkey'
    ) {
        // inject code into site context
        const script = document.createElement('script')
        script.appendChild(
            document.createTextNode(
                '(' + wrapper + ')(' + JSON.stringify(pluginInfo) + ');'
            )
        )
        ;(
            document.body ||
            document.head ||
            document.documentElement
        ).appendChild(script)
    } else {
        // Tampermonkey, run code directly
        wrapper(pluginInfo)
    }
})()
