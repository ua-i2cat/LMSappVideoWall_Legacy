$(document).ready( function() {
	//////////////////////////////////////////////////////////////
	//  					    PRAMETERS						//
	//////////////////////////////////////////////////////////////
	var apiURI = null;
	
	var sHost = null, 
		sPort = null;
	
    var inputWidth = 0,
        inputHeight =0,
        winWidth = 0,
        winHeight = 0;

	var lmsInstance = null, 
        lmsState = null,
		lmsInput = null,
        lmsVideos = [],
        lmsAudios = [],
        lmsPaths = [];
    
    var listCrops = [];
    var zIndexMax = 0;
    var idCrops = 1;

    var receiverId = 1000,
    	decoderId = 1100,
    	resamplerId = 1200,
    	videoSplitterId = 1300,
    	encoderId = 1401,
    	transmitterId = 1500,
    	pathTransmitterId = 2000;

    //////////////////////////////////////////////////////////////
    //                       EVENTS MANAGMENT                   //
    //////////////////////////////////////////////////////////////
	$("#view").load("./app/views/instance.html");

	$('#crop_modal').modal('show');

	$( document ).on( "submit", "form", function(event) {
        event.preventDefault(); // To prevent following the link (optional)
        var form = $(this);
        console.log(form.context.id);
        switch (form.context.id){
            case 'connectForm':
                connectForm(form);
                break;
            case 'setRTMPForm':
                setRTMPForm(form);
                break;
            case 'setRTSPForm':
                setRTSPForm(form);
                break;
            case 'setRTPvideoForm':
                setRTPForm(form);
                break;
            case 'setRTPavForm':
                setRTPForm(form);
                break;
            case 'setRTPaudioForm':
                setRTPForm(form);
                break;
            case 'createCropForm':
                createCropForm(form);
                break;
            case 'configureCropForm':
                configureCropForm(Number(document.getElementById('select-crop').textContent.substr(4,1)));
                break; 
            case 'configureAllCrops':
                for(crop in listCrops){
                    configureCropForm(listCrops[crop].id);
                }
                break;
            case 'deleteCrop':
                deleteCrop();
                break;
            case 'configureFrameTimeForm':
                configureFrameTimeForm(form);
                break; 
            default:
                addAlertError('ERROR: no form available');
        }
    });

    $('#disconnectButton').on('click', function(event) {
        bootbox.confirm("Are you sure to disconnect? This implies restarting the app...", function(result) {
            if(result){
                var uri = apiURI + '/disconnect';
                $.ajax({
                    type: 'GET',
                    url: uri,
                    dataType: 'json',
                    success : function(msg) {
                        if(!msg.error){
                            lmsVideos = [];
                            lmsAudios = [];
                            lmsInstance = null;
                            lmsState = null;
                            lmsPaths = [];
                            listCrops = [];
                            idCrops = 1;
                            addAlertSuccess(msg.message);
                            apiURI = null;
                            sHost = null;
                            sPort = null;
                            $("#disconnectButton").addClass("hidden");
                            $("#configureCropForm").removeClass("hidden");
                            $("#deleteCrop").removeClass("hidden");
                            $("#configureAllCrops").removeClass("hidden");
                            $("#state").html('');
                            $("#view").load("./app/views/instance.html");
                        } else {
                            addAlertError(msg.error);
                        }
                    },
                    error : function(xhr, msg) {
                        addAlertError('ERROR: ' + msg + ' - ' + xhr.responseText+ ' - No API available');
                    }
                })
            }
        });
    });

    window.addEventListener("beforeunload", function(event){
        event  = event || window.event;
        var reloadMessage = "\tALERT: If you refresh this page, you may lose settings.";
        event.returnValue = reloadMessage;
        return reloadMessage;
    });
	//////////////////////////////////////////////////////////////
	//  					    FORMS							//
	//////////////////////////////////////////////////////////////

	function connectForm(form) {
        var message = { 
            'host' : form.find( "input[id='server-host']" ).val(),
            'port' : form.find( "input[id='server-port']" ).val()
        };
        var apiHost = form.find( "input[id='api-host']" ).val();
        var apiPort = form.find( "input[id='api-port']" ).val();

        sHost = form.find( "input[id='server-host']" ).val();
        sPort = form.find( "input[id='server-port']" ).val();

        var uri = 'http://'+apiHost+':'+apiPort+'/api/connect';
        $.ajax({
            type: 'POST',
            url: uri,
            data: message,
            dataType: 'json',
            success : function(msg) {
                if(!msg.error){
                    lmsInstance = message;
                    addAlertSuccess(msg.message);
                    apiURI = 'http://'+apiHost+':'+apiPort+'/api';
                    console.log(apiURI);
                    $("#disconnectButton").removeClass("hidden");
                    $("#view").load("./app/views/input.html");
                } else {
                    lmsInstance = null;
                    addAlertError(msg.error);
                }
            },
            error : function(xhr, msg) {
                lmsInstance = null;
                addAlertError('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })
    };

    function setRTMPForm(form) {
        var uri = form.find( "input[id='uri']" ).val();
        if(/^(rtmp):\/\/[^ "]+$/.test(uri)){
            lmsInput = {
                'params': {
                    'uri' : uri
                }
            };   
            addAlertSuccess('Success setting network input params');

            setReceiverToSplitter();
            createFilter(transmitterId, "transmitter");
            $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                if(stat="succes"){
                    getState();
                    var content = document.getElementById('contentCrop');
                    var spinner = new Spinner().spin();
                    content.appendChild(spinner.el);
                    for(var filterIn in lmsState.filters){
                        if (lmsState.filters[filterIn].type == "videoDecoder"){
                            while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                getState();
                            }
                            content.removeChild(spinner.el);
                            inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                            inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                            var grid = document.getElementById('grid-snap');
                            winWidth = $("#grid-snap").width();
                            winHeight=((inputHeight*winWidth)/inputWidth).toFixed(0);
                            grid.style.height= winHeight+'px';
                            break;
                        }
                    }
                }
            });
        } else {
            lmsInput = null;
            addAlertError('ERROR: no valid inputs... please check.');
        }
    };

    function setRTSPForm(form) {
        var uri = form.find( "input[id='uri']" ).val();
        if(/^(rtsp):\/\/[^ "]+$/.test(uri)){
            lmsInput = {
                'params'    : {
                    "uri"       : uri
                }
            };  
            addAlertSuccess('Success setting network input params');

            setReceiverToSplitterRTMP();
            createFilter(transmitterId, "transmitter");
            $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                if(stat="succes"){
                    getState();
                    var content = document.getElementById('contentCrop');
                    var spinner = new Spinner().spin();
                    content.appendChild(spinner.el);
                    for(var filterIn in lmsState.filters){
                        if (lmsState.filters[filterIn].type == "videoDecoder"){
                            while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                getState();
                            }
                            content.removeChild(spinner.el);
                            inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                            inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                            var grid = document.getElementById('grid-snap');
                            winWidth = $("#grid-snap").width();
                            winHeight=((inputHeight*winWidth)/inputWidth).toFixed(0);
                            grid.style.height= winHeight+'px';
                            break;
                        }
                    }
                }
            });
        } else {
            lmsInput = null;
            addAlertError('ERROR: no valid inputs... please check.');
        }
    };

    function setRTPForm(form) {
        switch(form.find( "input[name='rtpInput']" ).val()){
            case 'v':
                var vport = form.find( "input[name='port']" ).val();
                if(form.find( "select[name='codec']" ).val() === "none" || isNaN(vport)){
                    lmsInput = null;
                    addAlertError('ERROR: no valid inputs... please check.');
                } else {
                    lmsInput = {
                        'params'    : {
                            "subsessions":[
                                {
                                    "medium":"video",
                                    "codec":form.find( "select[name='codec']" ).val(),
                                    "bandwidth":5000,
                                    "timeStampFrequency":90000,
                                    "channels":null,
                                    "port":parseInt(vport)
                                }   
                            ]
                        }
                    };
                    addAlertSuccess('Success setting network input params');
                    createFilter(receiverId, "receiver");
                    setReceiverToSplitter(form.find( "input[name='rtpInput']" ).val());
                    createFilter(transmitterId, "transmitter");
                    $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                        if(stat="succes"){
                            getState();
                            var content = document.getElementById('contentCrop');
                            var spinner = new Spinner().spin();
                            content.appendChild(spinner.el);
                            for(var filterIn in lmsState.filters){
                                if (lmsState.filters[filterIn].type == "videoDecoder"){
                                    while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                        getState();
                                    }
                                    content.removeChild(spinner.el);
                                    inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                                    inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                                    var grid = document.getElementById('grid-snap');
                                    winWidth = $("#grid-snap").width();
                                    winHeight=((inputHeight*winWidth)/inputWidth).toFixed(0);
                                    grid.style.height= winHeight+'px';
                                    break;
                                }
                            }
                        }
                    });
                }
                break;
            case 'a':
                var aport = form.find( "input[name='port']" ).val();
                if(form.find( "select[name='codec']" ).val() === "none" 
                    || form.find( "select[name='sampleRate']" ).val() === "none" 
                    || form.find( "select[name='channels']" ).val() === "none"
                    || isNaN(aport)){
                        lmsInput = null;
                        addAlertError('ERROR: no valid inputs... please check.');
                } else {
                    lmsInput = {
                        'params'    : {
                            "subsessions":[
                                {
                                    "medium":"audio",
                                    "codec":form.find( "select[name='codec']" ).val(),
                                    "bandwidth":192000,
                                    "timeStampFrequency":parseInt(form.find( "select[name='sampleRate']" ).val()),
                                    "channels":parseInt(form.find( "select[name='channels']" ).val()),
                                    "port":parseInt(aport),
                                }   
                            ]
                        }
                    };
                    addAlertSuccess('Success setting network input params');

                    createFilter(receiverId, "receiver");
                    createFilter(transmitterId, "transmitter");
                    setReceiverToTransmitterAudio(form.find( "input[name='rtpInput']" ).val());

                    $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                    });
                }
                break;
            case 'av':
                var aport = form.find( "input[name='audio-port']" ).val();
                var vport = form.find( "input[name='video-port']" ).val();
                if(form.find( "select[name='audio-codec']" ).val() === "none" 
                    || form.find( "select[name='video-codec']" ).val() === "none"
                    || form.find( "select[name='sampleRate']" ).val() === "none" 
                    || form.find( "select[name='channels']" ).val() === "none"
                    || isNaN(aport)
                    || isNaN(vport)){
                        lmsInput = null;
                        addAlertError('ERROR: no valid inputs... please check.');
                } else {
                    lmsInput = {
                        'audioParams'    : {
                            "subsessions":[
                                {
                                    "medium":"audio",
                                    "codec":form.find( "select[name='audio-codec']" ).val(),
                                    "bandwidth":192000,
                                    "timeStampFrequency":parseInt(form.find( "select[name='sampleRate']" ).val()),
                                    "channels":parseInt(form.find( "select[name='channels']" ).val()),
                                    "port":parseInt(aport),
                                }   
                            ]
                        },
                        'videoParams'    : {
                            "subsessions":[
                                {
                                    "medium":"video",
                                    "codec":form.find( "select[name='video-codec']" ).val(),
                                    "bandwidth":5000,
                                    "timeStampFrequency":90000,
                                    "channels":null,
                                    "port":parseInt(vport),
                                }   
                            ]
                        }
                    };
                    addAlertSuccess('Success setting network input params');

                    createFilter(receiverId, "receiver");
                    createFilter(transmitterId, "transmitter");
                    setReceiverToTransmitterAudio(form.find( "input[name='rtpInput']" ).val());
                    setReceiverToSplitter(form.find( "input[name='rtpInput']" ).val());

                    $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                        if(stat="succes"){
                            getState();
                            var content = document.getElementById('contentCrop');
                            var spinner = new Spinner().spin();
                            content.appendChild(spinner.el);
                            for(var filterIn in lmsState.filters){
                                if (lmsState.filters[filterIn].type == "videoDecoder"){
                                    while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                        getState();
                                    }
                                    content.removeChild(spinner.el);
                                    inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                                    inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                                    var grid = document.getElementById('grid-snap');
                                    winWidth = $("#grid-snap").width();
                                    winHeight=((inputHeight*winWidth)/inputWidth).toFixed(0);
                                    grid.style.height= winHeight+'px';
                                    break;
                                }
                            }
                        }
                    });
                }
                break;
            default:
                lmsInput = null;
                addAlertError('ERROR: no valid inputs... please check.');
                break;
        }
    };


    function createCropForm(form){
    	var message = { 
    		'id' : idCrops,
            'outputResolutionWidth' : Number(form.find( "input[id='resolution-width']" ).val()),
            'outputResolutionHeight' : Number(form.find( "input[id='resolution-height']" ).val()),
            'x' : 0,
            'y' : 0,
            'width' : (winWidth/2).toFixed(0),
            'height' : (winHeight/2).toFixed(0),
            'pathId': pathTransmitterId
        };
        $('#crop_modal').modal('hide');
        
        var grid = document.getElementById('grid-snap');
        var div = document.createElement('div');
        
        div.id = 'crop' + idCrops;
    	div.className = 'outputCrop';
    	div.style.maxWidth = winWidth + "px";
    	div.style.maxHeight = winHeight + "px";
        div.style.width = message.width + "px";
        div.style.height = message.height + "px";
    	div.innerHTML =  '#crop' + idCrops;
     	document.getElementById('grid-snap').appendChild(div);
     	
        addCropToList(message);
     	setSplitterToTransmitter(message);
        setCrop(div);
        if(listCrops.length==1){
            $("#configureCropForm").removeClass("hidden");
            $("#deleteCrop").removeClass("hidden");
        }
        if(listCrops.length>1){$("#configureAllCrops").removeClass("hidden");};
     	++idCrops;
    };

    

    function configureCropForm(crop){
        var object = listCrops.filter(function(element) {return element.id == crop})[0];
        var lmsSplitter = {
                        'params'    : {
                            "id": Number(object.id),
                            "width": Number(object.width),
                            "height":Number(object.height),
                            "x":Number(object.x),
                            "y":Number(object.y)
                        }
                    };
        configureFilter(videoSplitterId, "configCrop", lmsSplitter.params);
    };

    function configureFrameTimeForm(form){
        var lmsSplitter = {
                        'params'    : {
                            "fTime": Number(form.find( "input[id='frame-time']" ).val())
                        }
                    };
        configureFilter(videoSplitterId, "configure", lmsSplitter.params)
    };

    function deleteCrop(){
        var idSelected = Number(document.getElementById('select-crop').textContent.substr(4,1));
        var pathDeleted = listCrops.filter(function(element) {return element.id == idSelected})[0];
        
        if(deletePath(pathDeleted.pathId)){
            lmsPaths.splice(lmsPaths.map(function(element) {return element.id}).indexOf(pathDeleted.pathId), 1);
            listCrops.splice(listCrops.map(function(element) {return element.id}).indexOf(idSelected), 1);
            document.getElementById('grid-snap').removeChild(document.getElementById(document.getElementById('select-crop').textContent));

            document.getElementById('select-crop').textContent ="";
            document.getElementById('x-crop').textContent ="";
            document.getElementById('y-crop').textContent ="";
            document.getElementById('width-crop').textContent ="";
            document.getElementById('height-crop').textContent ="";
        }

    };
    //////////////////////////////////////////////////////////////
	//  			SPECIFIC SCENARIO/UI METHODS				//
	//////////////////////////////////////////////////////////////
	function addCropToList(message){
    	listCrops.push(message);
    };

    function countLayer(){
        var count = listCrops.length;
        for (var i = 0;i<count; i++){
            if(document.getElementById("crop"+listCrops[i].id).style.zIndex>zIndexMax){
                zIndexMax=Number(document.getElementById("crop"+listCrops[i].id).style.zIndex);
            }
        };
    };

    function setCrop(tarjet){
        var object = listCrops.filter(function(element) {return element.id == tarjet.id.substr(4,1)})[0];
        var inputCrop = document.getElementById('select-crop');
        var inputX = document.getElementById('x-crop');
        var inputY = document.getElementById('y-crop');
        var inputW = document.getElementById('width-crop');
        var inputH = document.getElementById('height-crop');
        var cropDiv = document.getElementById('crop'+ object.id);
        
        object.x = (cropDiv.getAttribute('data-x')*inputWidth/winWidth).toFixed(0) || 0;
        object.y = (cropDiv.getAttribute('data-y')*inputHeight/winHeight).toFixed(0) || 0;
        if(object.x<0) object.x=0;
        if(object.y<0) object.y=0;
        object.width = (cropDiv.clientWidth*inputWidth/winWidth).toFixed(0);
        object.height = (cropDiv.clientHeight*inputHeight/winHeight).toFixed(0);

        inputCrop.innerHTML = 'crop'+object.id;
        inputX.innerHTML = object.x;
        inputY.innerHTML = object.y;
        inputW.innerHTML = object.width;
        inputH.innerHTML = object.height;
    }

    function setSplitterToTransmitter(message){
    	
        //CREATE RESAMPLER 
        createFilter(resamplerId, "videoResampler");
     	var lmsResampler = {
                        'params'    : {
                            "width":Number(message.outputResolutionWidth),
				            "height":Number(message.outputResolutionHeight),
				            "discartPeriod":0,
				            "pixelFormat":2
                        }
                    };
		configureFilter(resamplerId, "configure", lmsResampler.params);
		
        //CREATE ENCODER
        createFilter(encoderId, "videoEncoder");
		var lmsEncoder = {
                        'params'    : {
                            "bitrate":1000,
				            "fps":25,
				            "gop":25,
				            "lookahead":50,
				            "threads":6,
				            "annexb":true,
				            "preset":"superfast"
                        }
                    };
     	configureFilter(encoderId, "configure", lmsEncoder.params);
     	
        //CREATE PATH
        var midFiltersIds = [resamplerId, encoderId];
        createPath(pathTransmitterId, videoSplitterId, transmitterId, idCrops, idCrops, midFiltersIds);
     	
        //CONFIGURE CROP
        var object = listCrops.filter(function(element) {return element.id == idCrops})[0];
        
    	
     	var lmsSplitter = {
                        'params'    : {
                            "id": Number(object.id),
                            "width": Number(object.width),
                            "height":Number(object.height),
                            "x":Number(object.x),
                            "y":Number(object.y)
                        }
                    };
		configureFilter(videoSplitterId, "configCrop", lmsSplitter.params);
		//CONFIGURE TRANSMITTER
        var plainrtp = "plainrtp" + idCrops;
		var lmsTransmitter = {
                        'params'    : {
                            "id":idCrops,
				            "txFormat":"std",
				            "name":plainrtp,
				            "info":plainrtp,
				            "desc":plainrtp,
				            "readers":[idCrops]
                        }
                    };
		configureFilter(transmitterId, "addRTSPConnection", lmsTransmitter.params);
     	++pathTransmitterId;
     	++resamplerId;
     	++encoderId;
    };

	function setReceiverToSplitter(rtpType){
        createFilter(decoderId, "videoDecoder");
        createFilter(resamplerId, "videoResampler");
        var lmsResampler = {
                        'params'    : {
                            "width":0,
                            "height":0,
                            "discartPeriod":0,
                            "pixelFormat":0
                        }
                    };
        configureFilter(resamplerId, "configure", lmsResampler.params);
        createFilter(videoSplitterId, "videoSplitter");
        var midFiltersIds = [decoderId,resamplerId];

        switch(rtpType){
            case 'v':
                configureFilter(receiverId, 'addSession', lmsInput.params);
                createPath(lmsInput.params.subsessions[0].port, receiverId, videoSplitterId, lmsInput.params.subsessions[0].port, -1, midFiltersIds);
                break;
            case 'av':
                configureFilter(receiverId, 'addSession', lmsInput.videoParams);
                createPath(lmsInput.videoParams.subsessions[0].port, receiverId, videoSplitterId, lmsInput.videoParams.subsessions[0].port, -1, midFiltersIds);
                break;
        }
		++resamplerId;
	};

    function setReceiverToSplitterRTMP(){
        createFilter(receiverId, "receiver");
        configureFilter(receiverId, 'configure', lmsInput.params);
        createFilter(decoderId, "videoDecoder");
        createFilter(resamplerId, "videoResampler");
        var lmsResampler = {
                        'params'    : {
                            "width":0,
                            "height":0,
                            "discartPeriod":0,
                            "pixelFormat":0
                        }
                    };
        configureFilter(resamplerId, "configure", lmsResampler.params);
        createFilter(videoSplitterId, "videoSplitter");
        var midFiltersIds = [decoderId,resamplerId];
        createPath(lmsInput.params.subsessions[0].port, receiverId, videoSplitterId, lmsInput.params.subsessions[0].port, -1, midFiltersIds);
        
        ++resamplerId;
    };
    
    function setReceiverToTransmitterAudio(rtpType){
        
        var midFiltersIds = [];
        switch(rtpType){
            case 'a':
                configureFilter(receiverId, 'addSession', lmsInput.params);
                createPath(lmsInput.params.subsessions[0].port, receiverId, transmitterId, lmsInput.params.subsessions[0].port, lmsInput.params.subsessions[0].port, midFiltersIds);
                var plainrtp = "plainrtp" + lmsInput.params.subsessions[0].port;
                var lmsTransmitter = {
                                'params'    : {
                                    "id":lmsInput.params.subsessions[0].port,
                                    "txFormat":"std",
                                    "name":plainrtp,
                                    "info":plainrtp,
                                    "desc":plainrtp,
                                    "readers":[lmsInput.params.subsessions[0].port]
                                }
                            };
                break;
            case 'av':
                configureFilter(receiverId, 'addSession', lmsInput.audioParams);
                createPath(lmsInput.audioParams.subsessions[0].port, receiverId, transmitterId, lmsInput.audioParams.subsessions[0].port, lmsInput.audioParams.subsessions[0].port, midFiltersIds);
                var plainrtp = "plainrtp" + lmsInput.audioParams.subsessions[0].port;
                var lmsTransmitter = {
                                'params'    : {
                                    "id":lmsInput.audioParams.subsessions[0].port,
                                    "txFormat":"std",
                                    "name":plainrtp,
                                    "info":plainrtp,
                                    "desc":plainrtp,
                                    "readers":[lmsInput.audioParams.subsessions[0].port]
                                }
                            };
                break;
        }
        configureFilter(transmitterId, "addRTSPConnection", lmsTransmitter.params);
    };

    //////////////////////////////////////////////////////////////
	//  				SPECIFIC API METHODS					//
	//////////////////////////////////////////////////////////////
    function configureFilter(filterId, action, params) {
        var okmsg = false;
        var message = [{
                        "action":action,
                        "params":params
                    }];
        $.ajax({
            type: 'PUT',
            async: false,
            url: apiURI+'/filter/'+filterId,
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("CONFIGURE FILTER");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };  

    function createFilter(filterId, type) {
        var okmsg = false;
        var message = {'id' : Number(filterId), 'type' : type};

        $.ajax({
            type: 'POST',
            async: false,
            url: apiURI+'/createFilter',
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("CREATE FILTER");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };       

    function createPath(pathId, orgFilterId, dstFilterId, orgWriterId, dstReaderId, midFiltersIds) {
        var okmsg = false;
        var message = { 'id' : pathId, 'orgFilterId' : orgFilterId, 'dstFilterId' : dstFilterId, 
                        'orgWriterId' : orgWriterId, 'dstReaderId' : dstReaderId, 'midFiltersIds' : midFiltersIds };
        lmsPaths.push(message);
        console.log("NEW PATH")
        console.log(message)
        $.ajax({
            type: 'POST',
            async: false,
            url: apiURI+'/createPath',
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("CREATE PATH");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };

    function deletePath(pathId){
        var okmsg = false;
        console.log(pathId);
        console.log("DELETE PATH")
        $.ajax({
            type: 'DELETE',
            async: false,
            url: apiURI+'/path/'+pathId,
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("DELETE PATH");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };     

    function getState() {
        $.ajax({
            type: 'GET',
            url: apiURI+'/state',
            dataType: 'json',
            async: false,
            success : function(msg) {
                if(!msg.error){
                    lmsState = msg.message;
                    //console.log("STATE");
                    //console.log(lmsState);
                    return true;
                } else {
                    lmsState = null;
                    addAlertError(msg.error);
                    return false;
                }
            },
            error : function(xhr, msg) {
                lmsState = null;
                addAlertError('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
                return false;
            }
        })        
    }; 

    //////////////////////////////////////////////////////////////
	//  					ALERTS METHODS						//
	//////////////////////////////////////////////////////////////
    function addAlertError(message) {
        var id = 'lmsError';
        var JQueryId = "#" + id;
        $('#error').append(
            '<div style="display:none;" class="alert alert-warning" id="' + id + '">' +
                '<button type="button" class="close" data-dismiss="alert">' +
                '×</button><span class="glyphicon glyphicon-remove-sign" aria-hidden="true"></span> ' + message + '</div>');

        $(JQueryId).fadeIn(500);

        window.setTimeout(function () {
            // closing the popup
            $(JQueryId).fadeTo(300, 0.5).slideUp(1000, function () {
                $(JQueryId).alert('close');
            });
        }, 2000);
        return true;
    };
    function addAlertSuccess(message) {
        var id = 'lmsSuccess';
        var JQueryId = "#" + id;
        $('#success').append(
            '<div style="display:none;" class="alert alert-success" id="' + id + '">' +
                '<button type="button" class="close" data-dismiss="alert">' +
                '×</button><span class="glyphicon glyphicon-ok-sign" aria-hidden="true"></span> ' + message + '</div>');

        $(JQueryId).fadeIn(500);

        window.setTimeout(function () {
            // closing the popup
            $(JQueryId).fadeTo(300, 0.5).slideUp(1000, function () {
                $(JQueryId).alert('close');
            });
        }, 2000);
        return true;
    };
    
    //////////////////////////////////////////////////////////////
    //                      INTERACT METHODS                    //
    //////////////////////////////////////////////////////////////
    (function (interact) {
    
        var element = document.getElementById('grid-snap'),
        x = 0, y = 0;
        var layer = 1;

        interact('.outputCrop')
            .draggable({
                snap: {
                  mdoe: element,
                  range: Infinity,
                  element: { x: 0, y: 0 }
                },
                inertia: true,
                restrict: {
                  restriction: "parent",
                  endOnly: true,
                  elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
                },
                onmove: dragMoveListener
            })
            .resizable({
                inertia: true,
                preserveAspectRatio: true,
                edges: { left: false, right: true, bottom: true, top: false },
                onmove: dragResizeListener
            })
            .on('tap', function(event) {
                var target = event.target;
                target.style.zIndex = layer;
                setCrop(target);
                ++layer;
            })
            .on('doubletap', function(event){
                var target = event.target;
                if(target.clientWidth >= Number(target.style.maxWidth.replace(/\D/g,''))-20
                    && target.clientHeight >= Number(target.style.maxHeight.replace(/\D/g,''))-20)
                {
                    target.style.width  = (winWidth/2).toFixed(0) + 'px';
                    target.style.height = (winHeight/2).toFixed(0) + 'px';
                } else {
                    target.style.width  = winWidth + 'px';
                    target.style.height = winHeight + 'px';
                }
                setCrop(target);
                ++layer;
            });

        function dragMoveListener (event) {
            var target = event.target,
                // keep the dragged position in the data-x/data-y attributes
                x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
            target.style.zIndex = layer;
            // translate the element
            target.style.webkitTransform =
            target.style.transform =
              'translate(' + x.toFixed(0) + 'px, ' + y.toFixed(0) + 'px)';

            // update the posiion attributes
            target.setAttribute('data-x', x.toFixed(0));
            target.setAttribute('data-y', y.toFixed(0));
            setCrop(target);
            ++layer;
        }

        function dragResizeListener (event) {
            var target = event.target,
                    x = (parseInt(target.getAttribute('data-x')) || 0),
                    y = (parseInt(target.getAttribute('data-y')) || 0);

            target.style.zIndex = layer;

            if(target.clientWidth + Number(target.getAttribute('data-x')) < Number(target.style.maxWidth.replace(/\D/g,'')) 
                && target.clientHeight+Number(target.getAttribute('data-y')) < Number(target.style.maxHeight.replace(/\D/g,''))){
                // update the element's style
                target.style.width  = event.rect.width.toFixed(0) + 'px';
                target.style.height = event.rect.height.toFixed(0) + 'px';

                // translate when resizing from top or left edges
                x += event.deltaRect.left;
                y += event.deltaRect.top;

                target.style.webkitTransform = target.style.transform =
                    'translate(' + x + 'px,' + y + 'px)';

                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
                setCrop(target);
                ++layer;
            } else {
                if(target.clientWidth + Number(target.getAttribute('data-x')) > Number(target.style.maxWidth.replace(/\D/g,''))){
                    target.style.width  = (Number(target.style.maxWidth.replace(/\D/g,'')) - Number(target.getAttribute('data-x'))) + 'px';
                }
                if(target.clientHeight+Number(target.getAttribute('data-y')) > Number(target.style.maxHeight.replace(/\D/g,''))){
                    target.style.height = (Number(target.style.maxHeight.replace(/\D/g,'')) - Number(target.getAttribute('data-y'))) + 'px';
                }
            }
        }

        window.dragResizeListener = dragResizeListener;
        window.dragMoveListener = dragMoveListener;

    }(window.interact));
});