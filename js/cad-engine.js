if (typeof makerjs === 'undefined' && typeof MakerJs !== 'undefined') {
    window.makerjs = MakerJs;
}

const CadEngine = {
    /**
     * Helper to check if Maker.js is available
     */
    isLibReady: function() {
        if (typeof makerjs === 'undefined' && typeof MakerJs !== 'undefined') {
            window.makerjs = MakerJs;
        }
        return typeof makerjs !== 'undefined';
    },

    /**
     * Generate Industrial Fence model
     */
    createFence: function(length, fenceHeight, postHeight, topGap, postSpacing, postW, topRailH, midRailH, botRailH, picketW, picketSpacing, slope, postType = 'hss_rect', topRailType = 'plate', midRailType = 'plate', botRailType = 'plate', picketType = 'plate', includeBasePlates = 'no', bpW = 6.0, bpH = 0.5, bpHoleD = 0.5, bpHoleOffsetX = 0.5, bpHoleOffsetY = 0.25, midRailGap = 6.0) {
        if (!this.isLibReady()) return this._fallback_fence(length, fenceHeight, postHeight, topGap, postSpacing, postW, topRailH, midRailH, botRailH, picketW, picketSpacing, slope, postType, topRailType, midRailType, botRailType, picketType, includeBasePlates, bpW, bpH, bpHoleD, bpHoleOffsetX, bpHoleOffsetY, midRailGap);

        const model = { 
            models: { 
                posts: { models: {} }, 
                rails: { models: {} },
                pickets: { models: {} }
            } 
        };
        if (includeBasePlates === 'yes') {
            model.models.basePlates = { models: {} };
        }
        if (capPlateMode === 'yes' || capPlateMode === true) {
            model.models.capPlates = { models: {} };
        }
        
        const rad = slope * Math.PI / 180;
        const tan = Math.tan(rad);
        
        const noPosts = (postType === 'none' || postHeight === 0 || postSpacing === 0);
        const effectivePostW = noPosts ? 0 : postW;
        const effectiveEmbed = noPosts ? 0 : ((includeBasePlates === 'yes') ? 0 : Math.max(0, postHeight - fenceHeight - topGap - 6.0));
        
        // 1. Create Posts (Length represents the center-to-center of post 0 to last post)
        const numSpans = noPosts ? 1 : Math.max(1, Math.round(length / (postSpacing || 1)));
        const numPosts = noPosts ? 0 : numSpans + 1;
        const actualPostSpacing = noPosts ? length : (length / numSpans);
        const actualPostHeight = postHeight;
        
        if (!noPosts) {
            for (let i = 0; i < numPosts; i++) {
                const cx = i * actualPostSpacing;
                const px = cx - effectivePostW / 2;
                const pyBase = cx * tan;
                
                const post = { models: {}, paths: {} };
                post.models.outer = new makerjs.models.Rectangle(effectivePostW, actualPostHeight);
                
                const pt = 0.2; // post wall/flange thickness
                if (postType === 'hss_rect') {
                    if (effectivePostW > 2 * pt) {
                        post.models.inner = new makerjs.models.Rectangle(effectivePostW - 2 * pt, actualPostHeight - 2 * pt);
                        post.models.inner.origin = [pt, pt];
                    }
                } else if (postType === 'hss_circ') {
                    post.paths.center = new makerjs.paths.Line([effectivePostW / 2, 0], [effectivePostW / 2, actualPostHeight]);
                } else if (postType === 'w_beam') {
                    if (effectivePostW > 2 * pt) {
                        post.paths.flangeL = new makerjs.paths.Line([pt, 0], [pt, actualPostHeight]);
                        post.paths.flangeR = new makerjs.paths.Line([effectivePostW - pt, 0], [effectivePostW - pt, actualPostHeight]);
                    }
                } else if (postType === 'angles') {
                    if (effectivePostW > pt) {
                        post.paths.leg = new makerjs.paths.Line([pt, 0], [pt, actualPostHeight]);
                    }
                }
                
                post.origin = [px, pyBase - effectiveEmbed];
                model.models.posts.models['p' + i] = post;

                // Optional Base Plate at bottom of post
                if (includeBasePlates === 'yes') {
                    const plateW = bpW;
                    const plateH = bpH;
                    const bp = {
                        models: { outer: new makerjs.models.Rectangle(plateW, plateH) },
                        paths: {
                            h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                            h2: new makerjs.paths.Circle([plateW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                        }
                    };
                    
                    bp.origin = [cx - plateW/2, pyBase - effectiveEmbed - plateH];
                    makerjs.model.rotate(bp, slope, [cx, pyBase - effectiveEmbed]);
                    model.models.basePlates.models['bp' + i] = bp;
                }
            }
        }

        // 2. Create Rails (Welded to the inside faces of the posts, in between posts)
        let botY, topY, midY;
        if (noPosts) {
            botY = 4.0;
            topY = 4.0 + fenceHeight - topRailH;
        } else {
            botY = actualPostHeight - topGap - fenceHeight;
            topY = actualPostHeight - topGap - topRailH;
        }

        if (midRailType !== 'none') {
            midY = topY - midRailGap - midRailH;
        } else {
            midY = (botY + topY) / 2;
        }

        const createTiltedRailSpan = (cx_i, yIntercept, thickness, type) => {
            const rail = { models: {}, paths: {} };
            const clearWidth = actualPostSpacing - effectivePostW;
            const startX = cx_i + effectivePostW / 2;
            const endX = startX + clearWidth;

            if (slope !== 0) {
                const y_base = yIntercept - effectiveEmbed;
                const p1 = [startX, y_base + startX * tan];
                const p2 = [endX, y_base + endX * tan];
                const p3 = [endX, y_base + thickness + endX * tan];
                const p4 = [startX, y_base + thickness + startX * tan];
                rail.paths = {
                    bot: new makerjs.paths.Line(p1, p2),
                    right: new makerjs.paths.Line(p2, p3),
                    top: new makerjs.paths.Line(p3, p4),
                    left: new makerjs.paths.Line(p4, p1)
                };
                return rail;
            }
            
            // Calculate precise sloped length of the rail span: clearWidth / cos(slope)
            const cos = Math.cos(rad);
            const slopedWidth = cos > 0.001 ? (clearWidth / cos) : clearWidth;
            // Round to 1/16th inch precision
            const preciseSlopedWidth = Math.round(slopedWidth * 16) / 16;
            
            rail.models.outer = new makerjs.models.Rectangle(preciseSlopedWidth, thickness);
            
            const t = 0.2; // wall/flange thickness
            if (type === 'hss_rect') {
                if (thickness > 2 * t) {
                    rail.models.inner = new makerjs.models.Rectangle(preciseSlopedWidth, thickness - 2 * t);
                    rail.models.inner.origin = [0, t];
                }
            } else if (type === 'hss_circ') {
                rail.paths.center = new makerjs.paths.Line([0, thickness / 2], [preciseSlopedWidth, thickness / 2]);
            } else if (type === 'w_beam') {
                if (thickness > 2 * t) {
                    rail.paths.tf = new makerjs.paths.Line([0, thickness - t], [preciseSlopedWidth, thickness - t]);
                    rail.paths.bf = new makerjs.paths.Line([0, t], [preciseSlopedWidth, t]);
                }
            } else if (type === 'angles') {
                if (thickness > t) {
                    rail.paths.leg = new makerjs.paths.Line([0, t], [preciseSlopedWidth, t]);
                }
            }

            rail.origin = [startX, startX * tan - effectiveEmbed + yIntercept];
            return rail;
        };

        for (let i = 0; i < numSpans; i++) {
            const cx_i = i * actualPostSpacing;
            if (botRailType !== 'none') {
                if (!model.models.rails.models.bottom) model.models.rails.models.bottom = { models: {} };
                model.models.rails.models.bottom.models['span' + i] = createTiltedRailSpan(cx_i, botY, botRailH, botRailType);
            }
            if (midRailType !== 'none') {
                if (!model.models.rails.models.middle) model.models.rails.models.middle = { models: {} };
                model.models.rails.models.middle.models['span' + i] = createTiltedRailSpan(cx_i, midY, midRailH, midRailType);
            }
            if (topRailType !== 'none') {
                if (!model.models.rails.models.top) model.models.rails.models.top = { models: {} };
                model.models.rails.models.top.models['span' + i] = createTiltedRailSpan(cx_i, topY, topRailH, topRailType);
            }
        }

        // 3. Create Pickets (Vertical, ONLY inside post spans)
        const picketY = (botRailType === 'none') ? (botY + 4) : (botY + botRailH);
        const picketTopY = (midRailType !== 'none') ? midY : ((topRailType === 'none') ? (noPosts ? 4.0 + fenceHeight : actualPostHeight - topGap) : topY);
        const picketH = Math.max(2, picketTopY - picketY);
        
        let picketCount = 0;
        const clearWidth = actualPostSpacing - effectivePostW;
        const numPicketsInSpan = picketSpacing > 0 ? Math.floor((clearWidth - picketW) / picketSpacing) : 0;
        
        if (picketSpacing > 0 && numPicketsInSpan > 0 && numPicketsInSpan < 1000) {
            const occupiedWidth = (numPicketsInSpan - 1) * picketSpacing + picketW;
            const leftoverSpace = clearWidth - occupiedWidth;
            const margin = leftoverSpace / 2;
            
            for (let i = 0; i < numSpans; i++) {
                const cx_i = i * actualPostSpacing;
                const picketStartCenter = cx_i + effectivePostW / 2 + margin + picketW / 2;
                
                for (let k = 0; k < numPicketsInSpan; k++) {
                    const picketX = picketStartCenter + k * picketSpacing;
                    const pyBase = picketX * tan;
                    
                    const px = picketX - picketW / 2;
                    const py = pyBase - effectiveEmbed + picketY;
                    const w = picketW;
                    const h = picketH;
                    
                    const picket = { models: {}, paths: {} };
                    picket.models.outer = new makerjs.models.Rectangle(w, h);
                    
                    const pt = 0.15; // picket wall thickness
                    if (picketType === 'hss_rect') {
                        if (w > 2 * pt) {
                            picket.models.inner = new makerjs.models.Rectangle(w - 2 * pt, h);
                            picket.models.inner.origin = [pt, 0];
                        }
                    } else if (picketType === 'hss_circ') {
                        picket.paths.center = new makerjs.paths.Line([w / 2, 0], [w / 2, h]);
                    } else if (picketType === 'w_beam') {
                        if (w > 2 * pt) {
                            picket.paths.flangeL = new makerjs.paths.Line([pt, 0], [pt, h]);
                            picket.paths.flangeR = new makerjs.paths.Line([w - pt, 0], [w - pt, h]);
                        }
                    } else if (picketType === 'angles') {
                        if (w > pt) {
                            picket.paths.leg = new makerjs.paths.Line([pt, 0], [pt, h]);
                        }
                    }
                    
                    picket.origin = [px, py];
                    model.models.pickets.models['pick' + picketCount] = picket;
                    picketCount++;
                }
            }
        }

        return model;
    },

    _fallback_fence: (length, fenceHeight, postHeight, topGap, postSpacing, postW, topRailH, midRailH, botRailH, picketW, picketSpacing, slope, postType = 'hss_rect', topRailType = 'plate', midRailType = 'plate', botRailType = 'plate', picketType = 'plate', includeBasePlates = 'no', bpW = 6.0, bpH = 0.5, bpHoleD = 0.5, bpHoleOffsetX = 0.5, bpHoleOffsetY = 0.25, midRailGap = 6.0) => {
        const s = 4; // scale factor
        const L = length * s;
        const FH = fenceHeight * s;
        const TG = topGap * s;
        const PH = postHeight * s;
        const SP = postSpacing * s;
        const PW = picketW * s;
        const PS = picketSpacing * s;
        const rad = slope * Math.PI / 180;
        const tan = Math.tan(rad);
        
        let postsHtml = "";
        let basePlatesHtml = "";
        let railsHtml = "";
        let picketsHtml = "";
        
        const noPosts = (postType === 'none' || postHeight === 0 || postSpacing === 0);
        const effectivePH = noPosts ? fenceHeight * s : PH;
        const effectiveEmbed_scaled = noPosts ? 0 : ((includeBasePlates === 'yes') ? 0 : Math.max(0, postHeight - fenceHeight - topGap - 6.0) * s);
        
        const rise = length * tan;
        const maxRise = Math.max(0, rise);
        const groundY = (effectivePH - effectiveEmbed_scaled) + maxRise * s + 50;
        
        const numSpans = noPosts ? 1 : Math.max(1, Math.round(length / (postSpacing || 1)));
        const numPosts = noPosts ? 0 : numSpans + 1;
        const actualPostSpacing = noPosts ? length : (length / numSpans);
        const PW_scaled = noPosts ? 0 : postW * s;
        const effectivePostW = noPosts ? 0 : postW;

        // 1. Draw Posts
        if (!noPosts) {
            for (let i = 0; i < numPosts; i++) {
                const cx = i * actualPostSpacing;
                const px_scaled = (cx - postW / 2) * s;
                const pyBase = cx * tan;
                const pyBase_scaled = pyBase * s;
                const postY = groundY - pyBase_scaled - (PH - effectiveEmbed_scaled);
                
                let postInnerHtml = "";
                const pt = 0.2 * s;
                if (postType === 'hss_rect') {
                    if (PW_scaled > 2 * pt) {
                        postInnerHtml = `<rect class="hss-inner-line" x="${px_scaled + pt}" y="${postY + pt}" width="${PW_scaled - 2 * pt}" height="${PH - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                    }
                } else if (postType === 'hss_circ') {
                    postInnerHtml = `<line class="hss-inner-line" x1="${px_scaled + PW_scaled/2}" y1="${postY}" x2="${px_scaled + PW_scaled/2}" y2="${postY + PH}" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2" opacity="0.6"/>`;
                } else if (postType === 'w_beam') {
                    if (PW_scaled > 2 * pt) {
                        postInnerHtml = `
                            <line class="hss-inner-line" x1="${px_scaled + pt}" y1="${postY}" x2="${px_scaled + pt}" y2="${postY + PH}" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>
                            <line class="hss-inner-line" x1="${px_scaled + PW_scaled - pt}" y1="${postY}" x2="${px_scaled + PW_scaled - pt}" y2="${postY + PH}" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>
                        `;
                    }
                } else if (postType === 'angles') {
                    if (PW_scaled > pt) {
                        postInnerHtml = `<line class="hss-inner-line" x1="${px_scaled + pt}" y1="${postY}" x2="${px_scaled + pt}" y2="${postY + PH}" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                    }
                }
                
                postsHtml += `
                    <rect x="${px_scaled}" y="${postY}" width="${PW_scaled}" height="${PH}" fill="none" stroke="#00d4ff" stroke-width="2"/>
                    ${postInnerHtml}
                `;
                
                if (includeBasePlates === 'yes') {
                    const plateW = bpW;
                    const plateH = bpH;
                    const PW_scaled_bp = plateW * s;
                    const PH_scaled_bp = plateH * s;
                    
                    basePlatesHtml += `
                        <g transform="translate(${(cx * s)}, ${postY + PH}) rotate(${-slope})">
                            <rect x="${-PW_scaled_bp/2}" y="0" width="${PW_scaled_bp}" height="${PH_scaled_bp}" fill="none" stroke="#ffaa00" stroke-width="1.5"/>
                            <circle cx="${-PW_scaled_bp/2 + bpHoleOffsetX * s}" cy="${bpHoleOffsetY * s}" r="${(bpHoleD / 2) * s}" fill="none" stroke="#ffaa00" stroke-width="0.5"/>
                            <circle cx="${PW_scaled_bp/2 - bpHoleOffsetX * s}" cy="${bpHoleOffsetY * s}" r="${(bpHoleD / 2) * s}" fill="none" stroke="#ffaa00" stroke-width="0.5"/>
                        </g>
                    `;
                }
            }
        }
        
        // 2. Draw Rails
        let botY, topY, midY;
        if (noPosts) {
            botY = 4.0;
            topY = 4.0 + fenceHeight - topRailH;
        } else {
            botY = PH/s - topGap - fenceHeight;
            topY = PH/s - topGap - topRailH;
        }

        if (midRailType !== 'none') {
            midY = topY - midRailGap - midRailH;
        } else {
            midY = (botY + topY) / 2;
        }
        
        const drawTiltedRailSpan = (cx_i, yIntercept, thickness, type) => {
            const clearWidth = actualPostSpacing - effectivePostW;
            
            // Calculate precise sloped length of the rail span: clearWidth / cos(slope)
            const cos = Math.cos(rad);
            const slopedWidth = cos > 0.001 ? (clearWidth / cos) : clearWidth;
            // Round to 1/16th inch precision
            const preciseSlopedWidth = Math.round(slopedWidth * 16) / 16;
            
            const rx = (cx_i + effectivePostW / 2) * s;
            const ry = groundY - (yIntercept - (effectiveEmbed_scaled / s)) * s - thickness * s + (effectivePostW / 2 * tan * s) - (cx_i * tan * s);
            const w = preciseSlopedWidth * s;
            const h = thickness * s;
            const t = 0.2 * s;
            
            let innerHtml = "";
            if (type === 'hss_rect') {
                if (h > 2 * t) {
                    innerHtml = `<rect class="hss-inner-line" x="${rx}" y="${ry + t}" width="${w}" height="${h - 2 * t}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                }
            } else if (type === 'hss_circ') {
                innerHtml = `<line class="hss-inner-line" x1="${rx}" y1="${ry + h/2}" x2="${rx + w}" y2="${ry + h/2}" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2" opacity="0.6"/>`;
            } else if (type === 'w_beam') {
                if (h > 2 * t) {
                    innerHtml = `
                        <line class="hss-inner-line" x1="${rx}" y1="${ry + t}" x2="${rx + w}" y2="${ry + t}" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>
                        <line class="hss-inner-line" x1="${rx}" y1="${ry + h - t}" x2="${rx + w}" y2="${ry + h - t}" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>
                    `;
                }
            } else if (type === 'angles') {
                if (h > t) {
                    innerHtml = `<line class="hss-inner-line" x1="${rx}" y1="${ry + h - t}" x2="${rx + w}" y2="${ry + h - t}" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                }
            }
            
            return `<g transform="rotate(${-slope}, ${rx}, ${ry + h})">
                <rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
                ${innerHtml}
            </g>`;
        };
        
        for (let i = 0; i < numSpans; i++) {
            const cx_i = i * actualPostSpacing;
            if (botRailType !== 'none') railsHtml += drawTiltedRailSpan(cx_i, botY, botRailH, botRailType);
            if (midRailType !== 'none') railsHtml += drawTiltedRailSpan(cx_i, midY, midRailH, midRailType);
            if (topRailType !== 'none') railsHtml += drawTiltedRailSpan(cx_i, topY, topRailH, topRailType);
        }
        
        // 3. Draw Pickets (Fitted ONLY inside post spans)
        const picketY_val = (botRailType === 'none') ? (botY + 4) : (botY + botRailH);
        const picketTopY_val = (midRailType !== 'none') ? midY : ((topRailType === 'none') ? (noPosts ? 4.0 + fenceHeight : PH/s - topGap) : topY);
        const picketH_val = Math.max(2, picketTopY_val - picketY_val);
        
        const clearWidth = actualPostSpacing - effectivePostW;
        const numPicketsInSpan = picketSpacing > 0 ? Math.floor((clearWidth - picketW) / picketSpacing) : 0;
        
        if (picketSpacing > 0 && numPicketsInSpan > 0 && numPicketsInSpan < 1000) {
            const occupiedWidth = (numPicketsInSpan - 1) * picketSpacing + picketW;
            const leftoverSpace = clearWidth - occupiedWidth;
            const margin = leftoverSpace / 2;
            
            for (let i = 0; i < numSpans; i++) {
                const cx_i = i * actualPostSpacing;
                const picketStartCenter = cx_i + effectivePostW / 2 + margin + picketW / 2;
                
                for (let k = 0; k < numPicketsInSpan; k++) {
                    const picketX = picketStartCenter + k * picketSpacing;
                    const picketX_scaled = picketX * s;
                    const pyBase = picketX * tan;
                    const pyBase_scaled = pyBase * s;
                    
                    const px = (picketX - picketW / 2) * s;
                    const py = groundY - pyBase_scaled - (picketTopY_val - (effectiveEmbed_scaled / s)) * s;
                    const pw = PW;
                    const ph = picketH_val * s;
                    const pt = 0.15 * s;
                    
                    let picketInnerHtml = "";
                    if (picketType === 'hss_rect') {
                        if (pw > 2 * pt) {
                            picketInnerHtml = `<rect class="hss-inner-line" x="${px + pt}" y="${py}" width="${pw - 2 * pt}" height="${ph}" fill="none" stroke="#00ffff" stroke-width="0.5" opacity="0.6"/>`;
                        }
                    } else if (picketType === 'hss_circ') {
                        picketInnerHtml = `<line class="hss-inner-line" x1="${px + pw/2}" y1="${py}" x2="${px + pw/2}" y2="${py + ph}" stroke="#00ffff" stroke-width="0.5" stroke-dasharray="2" opacity="0.6"/>`;
                    } else if (picketType === 'w_beam') {
                        if (pw > 2 * pt) {
                            picketInnerHtml = `
                                <line class="hss-inner-line" x1="${px + pt}" y1="${py}" x2="${px + pt}" y2="${py + ph}" stroke="#00ffff" stroke-width="0.5" opacity="0.6"/>
                                <line class="hss-inner-line" x1="${px + pw - pt}" y1="${py}" x2="${px + pw - pt}" y2="${py + ph}" stroke="#00ffff" stroke-width="0.5" opacity="0.6"/>
                            `;
                        }
                    } else if (picketType === 'angles') {
                        if (pw > pt) {
                            picketInnerHtml = `<rect class="hss-inner-line" x="${px + pt}" y="${py}" width="${pw - 2 * pt}" height="${ph}" fill="none" stroke="#00ffff" stroke-width="0.5" opacity="0.6"/>`;
                        }
                    }
                    
                    picketsHtml += `
                        <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none" stroke="#00ffff" stroke-width="1"/>
                        ${picketInnerHtml}
                    `;
                }
            }
        }
        
        const viewW = L + 50;
        const viewH = groundY + 100;
        const groundLineHtml = noPosts ? '' : `<line x1="${-postW/2 * s}" y1="${groundY + (postW/2 * tan * s)}" x2="${L + postW/2 * s}" y2="${groundY - rise * s - (postW/2 * tan * s)}" stroke="#555" stroke-width="2" stroke-dasharray="4"/>`;
        return `<svg viewBox="-20 -20 ${viewW} ${viewH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            ${groundLineHtml}
            ${postsHtml}
            ${basePlatesHtml}
            ${picketsHtml}
            ${railsHtml}
        </svg>`;
    },
    createHSSRect: function(w, h, t, holeConfig = null) {
        if (!this.isLibReady()) return this._fallback_rect(w, h, t, holeConfig);

        const outer = new makerjs.models.Rectangle(w, h);
        const inner = new makerjs.models.Rectangle(w - 2*t, h - 2*t);
        makerjs.model.center(inner);
        makerjs.model.center(outer);
        
        const model = { models: { outer, inner } };
        if (holeConfig && holeConfig.d > 0) {
            model.models.holes = this._createHolePattern(w, h, holeConfig);
        }
        return model;
    },

    /**
     * Generate a Circular HSS (Pipe) model
     */
    createHSSCirc: function(d, t, holeConfig = null) {
        if (!this.isLibReady()) return this._fallback_circ(d, t, holeConfig);
        const model = { models: { ring: new makerjs.models.Ring(d/2, (d/2) - t) } };
        if (holeConfig && holeConfig.d > 0) {
            // For circular, just put a hole in center for now
            model.models.holes = { paths: { h1: new makerjs.paths.Circle([0,0], holeConfig.d/2) } };
        }
        return model;
    },

    /**
     * Generate a W-Beam (I-Beam) model
     */
    createWBeam: function(d, bf, tf, tw, holeConfig = null) {
        if (!this.isLibReady()) return this._fallback_ibeam(d, bf, tf, tw, holeConfig);

        const model = { paths: {} };
        const hb = bf / 2, ht = tw / 2;

        model.paths.topFlange = new makerjs.paths.Line([-hb, d/2], [hb, d/2]);
        model.paths.tfbL = new makerjs.paths.Line([-hb, d/2 - tf], [-ht, d/2 - tf]);
        model.paths.tfbR = new makerjs.paths.Line([ht, d/2 - tf], [hb, d/2 - tf]);
        model.paths.tfeL = new makerjs.paths.Line([-hb, d/2], [-hb, d/2 - tf]);
        model.paths.tfeR = new makerjs.paths.Line([hb, d/2], [hb, d/2 - tf]);
        model.paths.webL = new makerjs.paths.Line([-ht, d/2 - tf], [-ht, -(d/2 - tf)]);
        model.paths.webR = new makerjs.paths.Line([ht, d/2 - tf], [ht, -(d/2 - tf)]);
        model.paths.botF = new makerjs.paths.Line([-hb, -d/2], [hb, -d/2]);
        model.paths.bfL = new makerjs.paths.Line([-hb, -(d/2 - tf)], [-ht, -(d/2 - tf)]);
        model.paths.bfR = new makerjs.paths.Line([ht, -(d/2 - tf)], [hb, -(d/2 - tf)]);
        model.paths.beL = new makerjs.paths.Line([-hb, -d/2], [-hb, -(d/2 - tf)]);
        model.paths.beR = new makerjs.paths.Line([hb, -d/2], [hb, -(d/2 - tf)]);

        if (holeConfig && holeConfig.d > 0) {
            model.models = { holes: this._createHolePattern(tw, d - 2*tf, holeConfig) };
        }

        return model;
    },

    /**
     * Generate AISC Angle model
     */
    createAngle: function(l1, l2, t, holeConfig = null) {
        if (!this.isLibReady()) return this._fallback_angle(l1, l2, t, holeConfig);

        const model = { paths: {} };
        model.paths.l1_out = new makerjs.paths.Line([0,0], [l1, 0]);
        model.paths.l1_end = new makerjs.paths.Line([l1, 0], [l1, t]);
        model.paths.l1_in = new makerjs.paths.Line([l1, t], [t, t]);
        model.paths.l2_in = new makerjs.paths.Line([t, t], [t, l2]);
        model.paths.l2_end = new makerjs.paths.Line([t, l2], [0, l2]);
        model.paths.l2_out = new makerjs.paths.Line([0, l2], [0, 0]);
        
        makerjs.model.center(model);
        return model;
    },

    /**
     * Generate Base Plate model
     */
    createPlate: function(w, h, holeD, holeOffsetX, holeOffsetY) {
        if (!this.isLibReady()) return this._fallback_plate(w, h, holeD, holeOffsetX, holeOffsetY);
        const plate = new makerjs.models.Rectangle(w, h);
    },

    calculatePlateDevelopedLength: function(leg1, leg2, t, insideRadius, bendAngle) {
        const R = parseFloat(insideRadius) || 0.25;
        const T = parseFloat(t) || 0.25;
        const theta = parseFloat(bendAngle) || 90;
        const K = 0.45;
        
        const thetaRad = theta * Math.PI / 180;
        const BA = thetaRad * (R + K * T);
        const OSSB = (R + T) * Math.tan(thetaRad / 2);
        const BD = 2 * OSSB - BA;
        
        const devLength = leg1 + leg2 - BD;
        return Math.max(0.1, Math.round(devLength * 16) / 16);
    },

    calculateCurvedHSSLength: function(radius, bendAngle) {
        const R = parseFloat(radius) || 12.0;
        const theta = parseFloat(bendAngle) || 90;
        const thetaRad = theta * Math.PI / 180;
        const length = R * thetaRad;
        return Math.max(0.1, Math.round(length * 16) / 16);
    },

    createBentPlateSideView: function(leg1, leg2, t, insideRadius) {
        if (!this.isLibReady()) return { paths: {} };
        const R = parseFloat(insideRadius) || 0.25;
        const T = parseFloat(t) || 0.25;
        const L1 = parseFloat(leg1) || 4.0;
        const L2 = parseFloat(leg2) || 4.0;
        
        const model = { paths: {} };
        model.paths.insideArc = new makerjs.paths.Arc([0,0], R, 180, 270);
        model.paths.outsideArc = new makerjs.paths.Arc([0,0], R + T, 180, 270);
        
        const leg1Top = L1 - (R + T);
        model.paths.leg1Inside = new makerjs.paths.Line([-R, 0], [-R, leg1Top]);
        model.paths.leg1Outside = new makerjs.paths.Line([-R - T, 0], [-R - T, leg1Top]);
        model.paths.leg1End = new makerjs.paths.Line([-R - T, leg1Top], [-R, leg1Top]);
        
        const leg2End = L2 - (R + T);
        model.paths.leg2Inside = new makerjs.paths.Line([0, -R], [leg2End, -R]);
        model.paths.leg2Outside = new makerjs.paths.Line([0, -R - T], [leg2End, -R - T]);
        model.paths.leg2End = new makerjs.paths.Line([leg2End, -R - T], [leg2End, -R]);
        
        return model;
    },

    createBentPlateMultiView: function(leg1, leg2, insideRadius, thickness, bendAngle, width, holeConfig) {
        if (!this.isLibReady()) return this._fallback_bent_plate(leg1, leg2, thickness, insideRadius, bendAngle, width, holeConfig);
        
        const R = parseFloat(insideRadius) || 0.25;
        const T = parseFloat(thickness) || 0.25;
        const L1 = parseFloat(leg1) || 4.0;
        const L2 = parseFloat(leg2) || 4.0;
        const theta = parseFloat(bendAngle) || 90;
        const W = parseFloat(width) || 6.0;
        
        // Calculate developed length
        const thetaRad = theta * Math.PI / 180;
        const K = 0.45;
        const BA = thetaRad * (R + K * T);
        const OSSB = (R + T) * Math.tan(thetaRad / 2);
        const BD = 2 * OSSB - BA;
        const devLen = L1 + L2 - BD;
        
        const model = { models: {} };
        
        // 1. Side / Folded Profile View
        const sideView = this.createBentPlateSideView(L1, L2, T, R);
        
        // 2. Flat developed pattern view
        const flatView = { models: {}, paths: {} };
        flatView.models.outer = new makerjs.models.Rectangle(devLen, W);
        
        const bendX = L1 - BD / 2;
        flatView.paths.bendLine = new makerjs.paths.Line([bendX, 0], [bendX, W]);
        
        // Set center for both
        makerjs.model.center(sideView);
        makerjs.model.center(flatView);
        
        // Distance them nicely
        const spacing = Math.max(8.0, L2 + devLen/2 + 2.0);
        sideView.origin = [-spacing / 2, 0];
        flatView.origin = [spacing / 2, 0];
        
        model.models.sideView = sideView;
        model.models.flatView = flatView;
        
        return model;
    },

    createCurvedHSSMultiView: function(radius, bendAngle, d, t) {
        if (!this.isLibReady()) return this._fallback_curved_hss(radius, bendAngle, d, t);
        
        const R = parseFloat(radius) || 12.0;
        const theta = parseFloat(bendAngle) || 90;
        const D = parseFloat(d) || 4.0;
        const T = parseFloat(t) || 0.25;
        
        const model = { models: {} };
        
        // 1. Profile View: concentric arcs
        const profileView = { paths: {} };
        const startAngle = 180;
        const endAngle = 180 + theta;
        
        profileView.paths.centerArc = new makerjs.paths.Arc([0,0], R, startAngle, endAngle);
        profileView.paths.insideArc = new makerjs.paths.Arc([0,0], R - D/2, startAngle, endAngle);
        profileView.paths.outsideArc = new makerjs.paths.Arc([0,0], R + D/2, startAngle, endAngle);
        
        // End caps
        const cosStart = Math.cos(startAngle * Math.PI / 180);
        const sinStart = Math.sin(startAngle * Math.PI / 180);
        profileView.paths.capStart = new makerjs.paths.Line(
            [(R - D/2) * cosStart, (R - D/2) * sinStart],
            [(R + D/2) * cosStart, (R + D/2) * sinStart]
        );
        
        const cosEnd = Math.cos(endAngle * Math.PI / 180);
        const sinEnd = Math.sin(endAngle * Math.PI / 180);
        profileView.paths.capEnd = new makerjs.paths.Line(
            [(R - D/2) * cosEnd, (R - D/2) * sinEnd],
            [(R + D/2) * cosEnd, (R + D/2) * sinEnd]
        );
        
        // 2. End View: Concentric hollow circles
        const endView = { models: { ring: new makerjs.models.Ring(D/2, D/2 - T) } };
        
        makerjs.model.center(profileView);
        makerjs.model.center(endView);
        
        const spacing = Math.max(8.0, R + D + 2.0);
        profileView.origin = [-spacing / 2, 0];
        endView.origin = [spacing / 2, 0];
        
        model.models.profileView = profileView;
        model.models.endView = endView;
        
        return model;
    },

    createCurvedHSSRectMultiView: function(radius, bendAngle, w, h, t) {
        if (!this.isLibReady()) return this._fallback_curved_hss(radius, bendAngle, h, t);
        
        const R = parseFloat(radius) || 12.0;
        const theta = parseFloat(bendAngle) || 90;
        const W = parseFloat(w) || 4.0;
        const H = parseFloat(h) || 4.0;
        const T = parseFloat(t) || 0.25;
        
        const model = { models: {} };
        
        // Profile View
        const profileView = { paths: {} };
        const startAngle = 180;
        const endAngle = 180 + theta;
        profileView.paths.insideArc = new makerjs.paths.Arc([0,0], R - H/2, startAngle, endAngle);
        profileView.paths.outsideArc = new makerjs.paths.Arc([0,0], R + H/2, startAngle, endAngle);
        
        // End caps
        const cosStart = Math.cos(startAngle * Math.PI / 180);
        const sinStart = Math.sin(startAngle * Math.PI / 180);
        profileView.paths.capStart = new makerjs.paths.Line(
            [(R - H/2) * cosStart, (R - H/2) * sinStart],
            [(R + H/2) * cosStart, (R + H/2) * sinStart]
        );
        
        const cosEnd = Math.cos(endAngle * Math.PI / 180);
        const sinEnd = Math.sin(endAngle * Math.PI / 180);
        profileView.paths.capEnd = new makerjs.paths.Line(
            [(R - H/2) * cosEnd, (R - H/2) * sinEnd],
            [(R + H/2) * cosEnd, (R + H/2) * sinEnd]
        );
        
        // End View: Concentric hollow rectangles
        const endView = { models: { 
            outer: new makerjs.models.Rectangle(W, H),
            inner: new makerjs.models.Rectangle(W - 2*T, H - 2*T)
        } };
        makerjs.model.center(endView.models.inner);
        makerjs.model.center(endView.models.outer);
        makerjs.model.center(endView);
        
        makerjs.model.center(profileView);
        
        const spacing = Math.max(8.0, R + H + 2.0);
        profileView.origin = [-spacing / 2, 0];
        endView.origin = [spacing / 2, 0];
        
        model.models.profileView = profileView;
        model.models.endView = endView;
        
        return model;
    },

    createWeldedUFrame: function(w, h, depth, tubeW, tubeH, tubeT) {
        if (!this.isLibReady()) return this._fallback_welded_u_frame(w, h, depth, tubeW, tubeH, tubeT);
        
        const W = parseFloat(w) || 12.0;
        const H = parseFloat(h) || 8.0;
        const D = parseFloat(depth) || 18.0;
        const tw = parseFloat(tubeW) || 1.5;
        const th = parseFloat(tubeH) || 1.5;
        const tt = parseFloat(tubeT) || 0.0747;
        
        const model = { models: {} };
        
        // 1. Front View (U-Shape with butt joints, sitting on top of bottom runner)
        const frontView = { models: {}, paths: {} };
        
        // Bottom runner goes horizontally from 0 to W
        frontView.models.bottom = new makerjs.models.Rectangle(W, th);
        frontView.models.bottom.origin = [0, 0];
        
        // Left and right vertical legs sit directly on top of the bottom runner, height H - th
        frontView.models.leftLeg = new makerjs.models.Rectangle(tw, H - th);
        frontView.models.leftLeg.origin = [0, th];
        
        frontView.models.rightLeg = new makerjs.models.Rectangle(tw, H - th);
        frontView.models.rightLeg.origin = [W - tw, th];
        
        // 2. Top View (Rectangular frame of size W by D with butt joints)
        const topView = { models: {}, paths: {} };
        
        // Side runners run full depth D
        topView.models.sideRunnerL = new makerjs.models.Rectangle(tw, D);
        topView.models.sideRunnerL.origin = [0, 0];
        
        topView.models.sideRunnerR = new makerjs.models.Rectangle(tw, D);
        topView.models.sideRunnerR.origin = [W - tw, 0];
        
        // Front and back runners butt between the side runners
        topView.models.frontRunner = new makerjs.models.Rectangle(W - 2 * tw, tw);
        topView.models.frontRunner.origin = [tw, 0];
        
        topView.models.backRunner = new makerjs.models.Rectangle(W - 2 * tw, tw);
        topView.models.backRunner.origin = [tw, D - tw];
        
        makerjs.model.center(frontView);
        makerjs.model.center(topView);
        
        const spacing = Math.max(8.0, W + 4.0);
        frontView.origin = [-spacing / 2, 0];
        topView.origin = [spacing / 2, 0];
        
        model.models.frontView = frontView;
        model.models.topView = topView;
        
        return model;
    },

    _fallback_bent_plate: function(leg1, leg2, thickness, insideRadius, bendAngle, width, holeConfig) {
        const s = 10;
        const L1 = leg1 * s, L2 = leg2 * s, W = width * s;
        return `<svg viewBox="-100 -50 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <path d="M 0 0 L 0 ${L1} L ${thickness*s} ${L1} L ${thickness*s} ${thickness*s} L ${L2} ${thickness*s} L ${L2} 0 Z" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <rect x="200" y="0" width="${(L1+L2)*0.9}" height="${W}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <line x1="${200 + L1*0.9}" y1="0" x2="${200 + L1*0.9}" y2="${W}" stroke="#00d4ff" stroke-width="1" stroke-dasharray="3"/>
        </svg>`;
    },

    _fallback_curved_hss: function(radius, bendAngle, d, t) {
        const s = 10, R = radius * s, D = d * s;
        return `<svg viewBox="-150 -150 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <path d="M -${R} 0 A ${R} ${R} 0 0 1 0 ${R}" fill="none" stroke="#00d4ff" stroke-width="${D}"/>
            <circle cx="200" cy="0" r="${D/2}" fill="none" stroke="#00d4ff" stroke-width="2"/>
        </svg>`;
    },

    _fallback_welded_u_frame: function(w, h, depth, tubeW, tubeH, tubeT) {
        const s = 10, W = w * s, H = h * s, D = depth * s, tw = tubeW * s, th = tubeH * s;
        return `<svg viewBox="-150 -100 450 250" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <!-- Front View (U-Shape with butt joints) -->
            <rect x="-100" y="${H-th}" width="${W}" height="${th}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
            <rect x="-100" y="0" width="${tw}" height="${H-th}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
            <rect x="${-100 + W - tw}" y="0" width="${tw}" height="${H-th}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
            
            <!-- Top View (Rectangular frame with butt joints) -->
            <rect x="150" y="0" width="${tw}" height="${D}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
            <rect x="${150 + W - tw}" y="0" width="${tw}" height="${D}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
            <rect x="${150 + tw}" y="0" width="${W - 2*tw}" height="${tw}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
            <rect x="${150 + tw}" y="${D - tw}" width="${W - 2*tw}" height="${tw}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
        </svg>`;
    },


    _createHolePattern: function(w, h, cfg) {
        const paths = {};
        const count = cfg.count || 1;
        const spacing = cfg.spacing || 0;
        const totalW = (count - 1) * spacing;
        const startX = -totalW / 2;
        for (let i = 0; i < count; i++) {
            paths['h'+i] = new makerjs.paths.Circle([startX + i*spacing, 0], cfg.d/2);
        }
        return { paths };
    },

    /** Fallbacks **/
    _fallback_rect: (w, h, t, holeConfig) => {
        const s = 10, sw = w * s, sh = h * s, st = t * s;
        let holes = "";
        if (holeConfig && holeConfig.d > 0) {
            const hd = holeConfig.d * s;
            const cnt = holeConfig.count || 1;
            const sp = (holeConfig.spacing || 0) * s;
            const totalWidth = (cnt - 1) * sp;
            const startX = sw/2 - totalWidth/2;
            for(let i=0; i<cnt; i++) {
                holes += `<circle cx="${startX + i*sp}" cy="${sh/2}" r="${hd/2}" fill="#ffaa00" opacity="0.8"/>`;
            }
        }
        return `<svg viewBox="-20 -20 ${sw+40} ${sh+40}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width="${sw}" height="${sh}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <rect x="${st}" y="${st}" width="${sw-2*st}" height="${sh-2*st}" fill="none" stroke="#00d4ff" stroke-width="1" stroke-dasharray="4"/>
            ${holes}
        </svg>`;
    },

    _fallback_circ: (d, t, holeConfig) => {
        const s = 10, sd = d * s, st = t * s;
        let hole = "";
        if (holeConfig && holeConfig.d > 0) {
            hole = `<circle cx="${sd/2}" cy="${sd/2}" r="${holeConfig.d*s/2}" fill="#ffaa00" opacity="0.8"/>`;
        }
        return `<svg viewBox="-20 -20 ${sd+40} ${sd+40}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <circle cx="${sd/2}" cy="${sd/2}" r="${sd/2}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <circle cx="${sd/2}" cy="${sd/2}" r="${sd/2-st}" fill="none" stroke="#00d4ff" stroke-width="1" stroke-dasharray="4"/>
            ${hole}
        </svg>`;
    },

    _fallback_ibeam: (d, bf, tf, tw, holeConfig) => {
        const s = 10, D=d*s, BF=bf*s, TF=tf*s, TW=tw*s;
        let holes = "";
        if (holeConfig && holeConfig.d > 0) {
            const hd = holeConfig.d * s, cnt = holeConfig.count || 1, sp = (holeConfig.spacing || 0) * s;
            const startY = D/2 - ((cnt-1)*sp)/2;
            for(let i=0; i<cnt; i++) {
                holes += `<circle cx="${BF/2}" cy="${startY + i*sp}" r="${hd/2}" fill="#ffaa00" opacity="0.8"/>`;
            }
        }
        return `<svg viewBox="-20 -20 ${BF+40} ${D+40}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width="${BF}" height="${TF}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <rect x="${BF/2 - TW/2}" y="${TF}" width="${TW}" height="${D-2*TF}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <rect x="0" y="${D-TF}" width="${BF}" height="${TF}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            ${holes}
        </svg>`;
    },

    _fallback_angle: (l1, l2, t, holeConfig) => {
        const s = 10, L1=l1*s, L2=l2*s, T=t*s;
        return `<svg viewBox="-20 -20 ${L1+40} ${L2+40}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <path d="M0,0 L${L1},0 L${L1},${T} L${T},${T} L${T},${L2} L0,${L2} Z" fill="none" stroke="#00d4ff" stroke-width="2"/>
        </svg>`;
    },

    _fallback_plate: (w, h, holeD, holeOffsetX, holeOffsetY) => {
        const s = 10, sw=w*s, sh=h*s, r=holeD/2*s, offX=holeOffsetX*s, offY=holeOffsetY*s;
        return `<svg viewBox="-20 -20 ${sw+40} ${sh+40}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width="${sw}" height="${sh}" fill="none" stroke="#00d4ff" stroke-width="2"/>
            <circle cx="${offX}" cy="${offY}" r="${r}" fill="none" stroke="#ffaa00" stroke-width="1"/>
            <circle cx="${sw-offX}" cy="${offY}" r="${r}" fill="none" stroke="#ffaa00" stroke-width="1"/>
            <circle cx="${sw-offX}" cy="${sh-offY}" r="${r}" fill="none" stroke="#ffaa00" stroke-width="1"/>
            <circle cx="${offX}" cy="${sh-offY}" r="${r}" fill="none" stroke="#ffaa00" stroke-width="1"/>
        </svg>`;
    },

    createCompositeDraft: function(members) {
        if (!this.isLibReady()) return this._fallback_composite_draft(members);

        const composite = { models: {} };

        members.forEach((m) => {
            let mModel = { models: {}, paths: {} };
            
            // Resolve standard dimensions if size !== 'CUSTOM'
            let w = m.params.w;
            let h = m.params.h;
            let t = m.params.t;
            let d = m.params.d;
            let bf = m.params.bf;
            let tf = m.params.tf;
            let tw = m.params.tw;
            let leg1 = m.params.leg1;
            let leg2 = m.params.leg2;

            if (m.size && m.size !== 'CUSTOM') {
                const shapes = SHAPES_DB[m.type] || [];
                const selected = shapes.find(s => s.id === m.size);
                if (selected) {
                    if (m.type === 'hss_rect') { w = selected.w; h = selected.h; t = selected.t; }
                    else if (m.type === 'hss_circ') { d = selected.d; t = selected.t; }
                    else if (m.type === 'w_beam') { d = selected.d; bf = selected.bf; tf = selected.tf; tw = selected.tw; }
                    else if (m.type === 'angles') { leg1 = selected.leg1; leg2 = selected.leg2; t = selected.t; }
                    else if (m.type === 'plate') { t = selected.t; }
                }
            }

            const length = m.length || 60.0;
            const view = m.viewType || 'profile';

            if (m.type === 'hss_rect') {
                if (view === 'profile') {
                    const outer = new makerjs.models.Rectangle(length, h);
                    const topWall = new makerjs.paths.Line([0, t], [length, t]);
                    const botWall = new makerjs.paths.Line([0, h - t], [length, h - t]);
                    mModel = { models: { outer }, paths: { topWall, botWall } };
                    makerjs.model.center(mModel);
                } else {
                    const outer = new makerjs.models.Rectangle(w, h);
                    const inner = new makerjs.models.Rectangle(Math.max(0.1, w - 2*t), Math.max(0.1, h - 2*t));
                    makerjs.model.center(inner);
                    makerjs.model.center(outer);
                    mModel = { models: { outer, inner } };
                }
            } else if (m.type === 'hss_circ') {
                if (view === 'profile') {
                    const outer = new makerjs.models.Rectangle(length, d);
                    const topWall = new makerjs.paths.Line([0, t], [length, t]);
                    const botWall = new makerjs.paths.Line([0, d - t], [length, d - t]);
                    mModel = { models: { outer }, paths: { topWall, botWall } };
                    makerjs.model.center(mModel);
                } else {
                    mModel = { models: { ring: new makerjs.models.Ring(d/2, Math.max(0.05, (d/2) - t)) } };
                }
            } else if (m.type === 'w_beam') {
                if (view === 'profile') {
                    const outer = new makerjs.models.Rectangle(length, d);
                    const topFlange = new makerjs.paths.Line([0, tf], [length, tf]);
                    const botFlange = new makerjs.paths.Line([0, d - tf], [length, d - tf]);
                    mModel = { models: { outer }, paths: { topFlange, botFlange } };
                    makerjs.model.center(mModel);
                } else {
                    mModel = this.createWBeam(d, bf, tf, tw, null);
                }
            } else if (m.type === 'angles') {
                if (view === 'profile') {
                    const outer = new makerjs.models.Rectangle(length, leg2);
                    const legLine = new makerjs.paths.Line([0, t], [length, t]);
                    mModel = { models: { outer }, paths: { legLine } };
                    makerjs.model.center(mModel);
                } else {
                    mModel = this.createAngle(leg1, leg2, t, null);
                }
            } else if (m.type === 'plate') {
                const outer = new makerjs.models.Rectangle(w, h);
                makerjs.model.center(outer);
                mModel = { models: { plate: outer } };
            }

            if (!mModel) return;

            // Conditional fabrication holes
            if (m.hasHoles && m.holes && m.holes.d > 0) {
                mModel.models.holes = { paths: {}, models: {} };
                const hd = m.holes.d;
                
                if (m.type === 'plate') {
                    const ox = Math.max(0.25, w / 2 - 1.0);
                    const oy = Math.max(0.25, h / 2 - 1.0);
                    const holePositions = [[-ox, -oy], [ox, -oy], [ox, oy], [-ox, oy]];
                    
                    holePositions.forEach((pos, hIdx) => {
                        mModel.models.holes.paths['h' + hIdx] = new makerjs.paths.Circle(pos, hd / 2);
                        
                        if (m.hasBolts && m.bolts && m.bolts.d > 0) {
                            const hex = new makerjs.models.Polygon(6, m.bolts.d * 0.75);
                            hex.origin = pos;
                            mModel.models.holes.models['b' + hIdx] = hex;
                        }
                    });
                } else {
                    const count = m.holes.count || 1;
                    const spacing = m.holes.spacing || 0;
                    const totalW = (count - 1) * spacing;
                    const startX = -totalW / 2;
                    
                    for (let i = 0; i < count; i++) {
                        const pos = [startX + i * spacing, 0];
                        mModel.models.holes.paths['h' + i] = new makerjs.paths.Circle(pos, hd / 2);
                        
                        if (m.hasBolts && m.bolts && m.bolts.d > 0) {
                            const hex = new makerjs.models.Polygon(6, m.bolts.d * 0.75);
                            hex.origin = pos;
                            mModel.models.holes.models['b' + i] = hex;
                        }
                    }
                }
            }

            // Apply rotation around the center
            if (m.rotation) {
                makerjs.model.rotate(mModel, m.rotation);
            }

            // Apply translation origin
            mModel.origin = [m.origin[0], m.origin[1]];

            composite.models[m.id] = mModel;
        });

        return composite;
    },

    _fallback_composite_draft: function(members) {
        let sw = 1200;
        let sh = 800;
        let scale = 10;
        
        let html = `<svg viewBox="-600 -400 ${sw} ${sh}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
        
        // Grid lines for AutoCAD-like feeling
        html += `<g stroke="#222" stroke-width="0.5">`;
        for (let x = -600; x <= 600; x += 50) {
            html += `<line x1="${x}" y1="-400" x2="${x}" y2="400" />`;
        }
        for (let y = -400; y <= 400; y += 50) {
            html += `<line x1="-600" y1="${y}" x2="600" y2="${y}" />`;
        }
        html += `</g>`;

        members.forEach((m) => {
            const ox = m.origin[0] * scale;
            const oy = -m.origin[1] * scale;
            const rot = -m.rotation;
            
            // Resolve standard dimensions if size !== 'CUSTOM'
            let w = m.params.w;
            let h = m.params.h;
            let t = m.params.t;
            let d = m.params.d;
            let bf = m.params.bf;
            let tf = m.params.tf;
            let tw = m.params.tw;
            let leg1 = m.params.leg1;
            let leg2 = m.params.leg2;

            if (m.size && m.size !== 'CUSTOM') {
                const shapes = SHAPES_DB[m.type] || [];
                const selected = shapes.find(s => s.id === m.size);
                if (selected) {
                    if (m.type === 'hss_rect') { w = selected.w; h = selected.h; t = selected.t; }
                    else if (m.type === 'hss_circ') { d = selected.d; t = selected.t; }
                    else if (m.type === 'w_beam') { d = selected.d; bf = selected.bf; tf = selected.tf; tw = selected.tw; }
                    else if (m.type === 'angles') { leg1 = selected.leg1; leg2 = selected.leg2; t = selected.t; }
                    else if (m.type === 'plate') { t = selected.t; }
                }
            }

            const length = m.length || 60.0;
            const view = m.viewType || 'profile';
            
            let shapeHtml = "";
            
            if (m.type === 'hss_rect') {
                if (view === 'profile') {
                    const lVal = length * scale;
                    const hVal = h * scale;
                    const tVal = t * scale;
                    shapeHtml += `<rect x="${-lVal/2}" y="${-hVal/2}" width="${lVal}" height="${hVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${-hVal/2+tVal}" x2="${lVal/2}" y2="${-hVal/2+tVal}" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${hVal/2-tVal}" x2="${lVal/2}" y2="${hVal/2-tVal}" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2"/>`;
                } else {
                    const wVal = w * scale;
                    const hVal = h * scale;
                    const tVal = t * scale;
                    shapeHtml += `<rect x="${-wVal/2}" y="${-hVal/2}" width="${wVal}" height="${hVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    if (wVal > 2*tVal && hVal > 2*tVal) {
                        shapeHtml += `<rect x="${-wVal/2+tVal}" y="${-hVal/2+tVal}" width="${wVal-2*tVal}" height="${hVal-2*tVal}" fill="none" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2"/>`;
                    }
                }
            } else if (m.type === 'hss_circ') {
                if (view === 'profile') {
                    const lVal = length * scale;
                    const dVal = d * scale;
                    const tVal = t * scale;
                    shapeHtml += `<rect x="${-lVal/2}" y="${-dVal/2}" width="${lVal}" height="${dVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${-dVal/2+tVal}" x2="${lVal/2}" y2="${-dVal/2+tVal}" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${dVal/2-tVal}" x2="${lVal/2}" y2="${dVal/2-tVal}" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2"/>`;
                } else {
                    const dVal = d * scale;
                    const tVal = t * scale;
                    shapeHtml += `<circle cx="0" cy="0" r="${dVal/2}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    if (dVal/2 > tVal) {
                        shapeHtml += `<circle cx="0" cy="0" r="${dVal/2 - tVal}" fill="none" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2"/>`;
                    }
                }
            } else if (m.type === 'w_beam') {
                if (view === 'profile') {
                    const lVal = length * scale;
                    const dVal = d * scale;
                    const tfVal = tf * scale;
                    shapeHtml += `<rect x="${-lVal/2}" y="${-dVal/2}" width="${lVal}" height="${dVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${-dVal/2+tfVal}" x2="${lVal/2}" y2="${-dVal/2+tfVal}" stroke="#00d4ff" stroke-width="0.5"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${dVal/2-tfVal}" x2="${lVal/2}" y2="${dVal/2-tfVal}" stroke="#00d4ff" stroke-width="0.5"/>`;
                } else {
                    const dVal = d * scale;
                    const bfVal = bf * scale;
                    const tfVal = tf * scale;
                    const twVal = tw * scale;
                    const hb = bfVal/2, ht = twVal/2;
                    shapeHtml += `<rect x="${-hb}" y="${-dVal/2}" width="${bfVal}" height="${tfVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    shapeHtml += `<rect x="${-ht}" y="${-dVal/2+tfVal}" width="${twVal}" height="${dVal - 2*tfVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    shapeHtml += `<rect x="${-hb}" y="${dVal/2-tfVal}" width="${bfVal}" height="${tfVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                }
            } else if (m.type === 'angles') {
                if (view === 'profile') {
                    const lVal = length * scale;
                    const legVal = leg2 * scale;
                    const tVal = t * scale;
                    shapeHtml += `<rect x="${-lVal/2}" y="${-legVal/2}" width="${lVal}" height="${legVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    shapeHtml += `<line x1="${-lVal/2}" y1="${-legVal/2+tVal}" x2="${lVal/2}" y2="${-legVal/2+tVal}" stroke="#00d4ff" stroke-width="0.5"/>`;
                } else {
                    const l1Val = leg1 * scale;
                    const l2Val = leg2 * scale;
                    const tVal = t * scale;
                    const cx = -l1Val/2, cy = -l2Val/2;
                    shapeHtml += `<path d="M${cx},${cy} L${cx+l1Val},${cy} L${cx+l1Val},${cy+tVal} L${cx+tVal},${cy+tVal} L${cx+tVal},${cy+l2Val} L${cx},${cy+l2Val} Z" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                }
            } else if (m.type === 'plate') {
                const wVal = w * scale;
                const hVal = h * scale;
                shapeHtml += `<rect x="${-wVal/2}" y="${-hVal/2}" width="${wVal}" height="${hVal}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
            }

            // Holes & Bolts in fallback
            if (m.hasHoles && m.holes && m.holes.d > 0) {
                const hd = m.holes.d * scale;
                const r = hd / 2;
                
                if (m.type === 'plate') {
                    const wVal = w * scale;
                    const hVal = h * scale;
                    const hox = Math.max(2, wVal/2 - 10);
                    const hoy = Math.max(2, hVal/2 - 10);
                    const positions = [[-hox, -hoy], [hox, -hoy], [hox, hoy], [-hox, hoy]];
                    
                    positions.forEach(pos => {
                        shapeHtml += `<circle cx="${pos[0]}" cy="${pos[1]}" r="${r}" fill="none" stroke="#ffaa00" stroke-width="1"/>`;
                        if (m.hasBolts && m.bolts && m.bolts.d > 0) {
                            const br = m.bolts.d * scale * 0.75;
                            shapeHtml += `<polygon points="${pos[0]},${pos[1]-br} ${pos[0]+br*0.86},${pos[1]-br*0.5} ${pos[0]+br*0.86},${pos[1]+br*0.5} ${pos[0]},${pos[1]+br} ${pos[0]-br*0.86},${pos[1]+br*0.5} ${pos[0]-br*0.86},${pos[1]-br*0.5}" fill="none" stroke="#ffaa00" stroke-width="0.5"/>`;
                        }
                    });
                } else {
                    const count = m.holes.count || 1;
                    const spacing = (m.holes.spacing || 0) * scale;
                    const totalW = (count - 1) * spacing;
                    const startX = -totalW / 2;
                    
                    for (let i = 0; i < count; i++) {
                        const px = startX + i * spacing;
                        shapeHtml += `<circle cx="${px}" cy="0" r="${r}" fill="none" stroke="#ffaa00" stroke-width="1"/>`;
                        if (m.hasBolts && m.bolts && m.bolts.d > 0) {
                            const br = m.bolts.d * scale * 0.75;
                            shapeHtml += `<polygon points="${px},${-br} ${px+br*0.86},${-br*0.5} ${px+br*0.86},${br*0.5} ${px},${br} ${px-br*0.86},${br*0.5} ${px-br*0.86},${-br*0.5}" fill="none" stroke="#ffaa00" stroke-width="0.5"/>`;
                        }
                    }
                }
            }

            html += `<g id="${m.id}" class="draft-member-group" transform="translate(${ox}, ${oy}) rotate(${rot})" style="cursor: pointer;">
                ${shapeHtml}
            </g>`;
        });
        
        html += `</svg>`;
        return html;
    },

    renderSVG: function(model) {
        if (typeof model === 'string') return model;
        if (!this.isLibReady()) return "<text x='10' y='30' fill='#f44'>CAD Engine Unavailable</text>";
        let svg = makerjs.exporter.toSVG(model, { useSubUnits: true, units: makerjs.unitType.Inch, stroke: '#00d4ff' });
        
        // Add 3% margin to viewBox bounds so outer line strokes are never clipped at edge
        const vbMatch = svg.match(/viewBox="([^"]+)"/);
        if (vbMatch && vbMatch[1]) {
            const vbParts = vbMatch[1].split(/[\s,]+/).map(Number);
            if (vbParts.length === 4 && !vbParts.some(isNaN)) {
                let [vx, vy, vw, vh] = vbParts;
                const padX = Math.max(0.5, vw * 0.03);
                const padY = Math.max(0.5, vh * 0.03);
                vx -= padX;
                vy -= padY;
                vw += padX * 2;
                vh += padY * 2;
                svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${vx} ${vy} ${vw} ${vh}"`);
            }
        }

        // Replace absolute unit width and height attributes with 100% so it fits any viewport container dynamically
        svg = svg.replace(/width="[^"]*"/, 'width="100%"');
        svg = svg.replace(/height="[^"]*"/, 'height="100%"');
        return svg;
    },

    renderClean2DSVG: function(model) {
        if (typeof model === 'string') return model;
        if (!this.isLibReady()) return this.renderSVG(model);
        
        try {
            // Deep clone the model to avoid mutating the original
            const clonedModel = JSON.parse(JSON.stringify(model));
            
            // Recursive function to clean up internal details for 2D representation
            const cleanModelFor2D = (m, route = []) => {
                if (!m) return;
                
                const inFenceMember = route.includes('posts') || route.includes('rails') || route.includes('pickets') || route.includes('puppyPickets');
                
                if (m.models && (m.models.outer || m.models.upper || m.models.lower || m.models.plate)) {
                    if (inFenceMember) {
                        // Keep outer, inner, upper, lower, holes/bolts for individual fence members
                        const keysToKeep = ['outer', 'inner', 'upper', 'lower', 'innerUpper', 'innerLower', 'plate', 'holes', 'bolts'];
                        for (const key in m.models) {
                            if (!keysToKeep.includes(key)) {
                                delete m.models[key];
                            }
                        }
                        // Remove all internal paths/centerlines
                        if (m.paths) {
                            m.paths = {};
                        }
                    } else if (m.models.outer) {
                        // For other members, remove specific profile-view inner lines
                        const profileInnerPaths = ['topWall', 'botWall', 'legLine', 'topFlange', 'botFlange'];
                        if (m.paths) {
                            for (const key in m.paths) {
                                if (profileInnerPaths.includes(key)) {
                                    delete m.paths[key];
                                }
                            }
                        }
                    }
                }
                
                if (m.models) {
                    for (const key in m.models) {
                        cleanModelFor2D(m.models[key], [...route, key]);
                    }
                }
            };
            
            cleanModelFor2D(clonedModel);
            return this.renderSVG(clonedModel);
        } catch (e) {
            console.warn("Error cleaning model for clean SVG render, falling back:", e);
            return this.renderSVG(model);
        }
    },

    exportDXF: function(model) {
        if (!this.isLibReady()) { 
            alert("CAD Engine (Maker.js) is not loaded. DXF export requires an internet connection for the CDN."); 
            return null; 
        }
        
        try {
            // Deep clone the model to avoid mutating the original
            const clonedModel = JSON.parse(JSON.stringify(model));
            
            // Recursive function to clean up internal details for 2D representation
            const cleanModelFor2D = (m, route = []) => {
                if (!m) return;
                
                // If it has "outer", it represents a hollow member in 2D profile or end view.
                // We strip all inner double lines systematically for ALL members, including individual piece marks.
                if (m.models && m.models.outer) {
                    // Keep only outer and holes/bolts
                    const keysToKeep = ['outer', 'inner', 'holes', 'bolts'];
                    for (const key in m.models) {
                        if (!keysToKeep.includes(key)) {
                            delete m.models[key];
                        }
                    }
                    // Remove all internal paths/centerlines/double lines
                    if (m.paths) {
                        m.paths = {};
                    }
                } else {
                    // For other members or W-beam profiles, remove specific profile-view inner lines
                    const profileInnerPaths = ['topWall', 'botWall', 'legLine', 'topFlange', 'botFlange'];
                    if (m.paths) {
                        for (const key in m.paths) {
                            if (profileInnerPaths.includes(key)) {
                                delete m.paths[key];
                            }
                        }
                    }
                }
                
                if (m.models) {
                    for (const key in m.models) {
                        cleanModelFor2D(m.models[key], [...route, key]);
                    }
                }
            };
            
            cleanModelFor2D(clonedModel);
            
            // Natively export the clean cloned model
            return makerjs.exporter.toDXF(clonedModel);
        } catch(e) {
            console.warn("Error cleaning model for DXF export, falling back:", e);
            return makerjs.exporter.toDXF(model);
        }
    },

    createFromStrokes: function(strokes, canvasWidth, canvasHeight) {
        if (!this.isLibReady()) {
            return { models: {} };
        }
        
        const model = { models: {} };
        
        // Find bounds of all strokes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let pointCount = 0;
        strokes.forEach(s => {
            s.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                pointCount++;
            });
        });
        
        if (pointCount < 2) return model;
        
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Scale to fit within a standard 120" x 72" CAD bounding box
        const targetW = 120.0;
        const targetH = 72.0;
        let scale = 0.2; 
        if (width > 0 && height > 0) {
            const scaleX = targetW / width;
            const scaleY = targetH / height;
            scale = Math.min(scaleX, scaleY);
        }
        
        // Build Maker.js paths
        strokes.forEach((s, sIdx) => {
            if (s.length < 2) return;
            const strokeModel = { paths: {} };
            
            for (let i = 0; i < s.length - 1; i++) {
                const p1 = s[i];
                const p2 = s[i+1];
                
                // CAD Y-axis is inverted relative to canvas, and center at [0,0]
                const x1 = (p1.x - centerX) * scale;
                const y1 = -(p1.y - centerY) * scale;
                const x2 = (p2.x - centerX) * scale;
                const y2 = -(p2.y - centerY) * scale;
                
                strokeModel.paths['seg' + i] = new makerjs.paths.Line([x1, y1], [x2, y2]);
            }
            
            model.models['stroke' + sIdx] = strokeModel;
        });
        
        return model;
    },

    createRailsGates: function(length, fenceHeight, postHeight, leftPostW, rightPostW, midPostW, midPostCount, topRailH, midRailH, botRailH, picketW, picketSpacing, slope = 0, leftPostType = 'hss_rect', rightPostType = 'hss_rect', midPostType = 'hss_rect', topRailType = 'hss_rect', midRailType = 'none', botRailType = 'hss_rect', picketType = 'hss_rect', includeBasePlates = 'no', bpW = 6.0, bpH = 0.5, bpHoleD = 0.5, bpHoleOffsetX = 0.5, bpHoleOffsetY = 0.25, midRailGap = 6.0, railsGatesType = 'gates', kickPlate = 'none', kickPlateH = 12.0, kickPlateWeld = 'inner', kickPlateSize = 'PL11GA', meshType = 'none', meshOpening = 2.0, infillType = 'pickets', puppyPickets = 'no', puppyPicketsLength = 16.0, puppyPicketsSpacing = 2.0, braceType = 'none', braceW = 2.0, sidingType = 'none', braceWeld = 'inner', deckPlacement = 'back', fluteOrientation = 'vertical', deckRetainer = 'none', picketMidJoint = 'through', maxDeckLen = 24.0, maxDeckWidth = 36.0, botRailElevation = 0.0, topGap = 0.0, wantLeftPost = 'no', wantRightPost = 'no', midPostCenters = null, lengthRef = 'c_to_c', capPlateMode = 'no', capPlateThickness = 0.25, capPlateWidth = 2.0, capPlateLength = 2.0, midRailExtraPickets = "no") {
        if (!this.isLibReady()) return this._fallback_rails_gates(length, fenceHeight, postHeight, leftPostW, rightPostW, midPostW, midPostCount, topRailH, midRailH, botRailH, picketW, picketSpacing, slope, leftPostType, rightPostType, midPostType, topRailType, midRailType, botRailType, picketType, includeBasePlates, bpW, bpH, bpHoleD, bpHoleOffsetX, bpHoleOffsetY, midRailGap, railsGatesType, kickPlate, kickPlateH, kickPlateWeld, kickPlateSize, meshType, meshOpening, infillType, puppyPickets, puppyPicketsLength, puppyPicketsSpacing, botRailElevation, topGap, wantLeftPost, wantRightPost, midPostCenters, lengthRef, capPlateMode, capPlateThickness, capPlateWidth, capPlateLength, midRailExtraPickets);

        const model = { 
            models: { 
                posts: { models: {} }, 
                rails: { models: {} },
                pickets: { models: {} }
            } 
        };
        if (includeBasePlates === 'yes') {
            model.models.basePlates = { models: {} };
        }

        midRailGap = (typeof midRailGap !== 'undefined' && !isNaN(parseFloat(midRailGap))) ? parseFloat(midRailGap) : 6.0;
        topRailH = (typeof topRailH !== 'undefined' && !isNaN(parseFloat(topRailH))) ? parseFloat(topRailH) : 1.5;
        midRailH = (typeof midRailH !== 'undefined' && !isNaN(parseFloat(midRailH))) ? parseFloat(midRailH) : 1.5;
        botRailH = (typeof botRailH !== 'undefined' && !isNaN(parseFloat(botRailH))) ? parseFloat(botRailH) : 1.5;
        picketW = (typeof picketW !== 'undefined' && !isNaN(parseFloat(picketW))) ? parseFloat(picketW) : 0.5;

        const safeSlope = (typeof slope !== 'undefined' && !isNaN(parseFloat(slope))) ? parseFloat(slope) : 0;
        const rad = safeSlope * Math.PI / 180;
        const tan = Math.tan(rad);
        const isGates = (railsGatesType === 'gates') && (safeSlope === 0);

        const createPolygonModel = (points) => {
            const m = { paths: {} };
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                m.paths['edge' + i] = new makerjs.paths.Line(p1, p2);
            }
            return m;
        };

        if (isGates) {
            // Mitred full frame gate
            const leftT = 0.12; 
            const rightT = 0.12;
            const topT = 0.12;
            const botT = 0.12;

            // 1. Left Side Runner (polygon with sloped miter ends)
            if (leftPostType !== 'none') {
                const leftOuter = [
                    [0, 0],
                    [leftPostW, botRailH],
                    [leftPostW, fenceHeight - topRailH],
                    [0, fenceHeight]
                ];
                const leftInner = [
                    [leftT, leftT],
                    [leftPostW - leftT, botRailH - leftT],
                    [leftPostW - leftT, fenceHeight - topRailH + leftT],
                    [leftT, fenceHeight - leftT]
                ];

                const leftPost = { models: {} };
                leftPost.models.outer = createPolygonModel(leftOuter);
                if (leftPostType === 'hss_rect' && leftPostW > 2 * leftT) {
                    leftPost.models.inner = createPolygonModel(leftInner);
                }
                model.models.posts.models['leftPost'] = leftPost;

                if (capPlateMode === 'yes' || capPlateMode === true) {
                    const capT = parseFloat(capPlateThickness) || 0.25;
                    const capW = parseFloat(capPlateWidth) || leftPostW;
                    const capLeft = {
                        models: { outer: new makerjs.models.Rectangle(capW, capT) },
                        origin: [leftPostW / 2 - capW / 2, fenceHeight]
                    };
                    if (!model.models.capPlates) model.models.capPlates = { models: {} };
                    model.models.capPlates.models['capLeft'] = capLeft;
                }
            }

            // 2. Right Side Runner
            if (rightPostType !== 'none') {
                const rightOuter = [
                    [length, 0],
                    [length - rightPostW, botRailH],
                    [length - rightPostW, fenceHeight - topRailH],
                    [length, fenceHeight]
                ];
                const rightInner = [
                    [length - rightT, rightT],
                    [length - rightPostW + rightT, botRailH - rightT],
                    [length - rightPostW + rightT, fenceHeight - topRailH + rightT],
                    [length - rightT, fenceHeight - rightT]
                ];

                const rightPost = { models: {} };
                rightPost.models.outer = createPolygonModel(rightOuter);
                if (rightPostType === 'hss_rect' && rightPostW > 2 * rightT) {
                    rightPost.models.inner = createPolygonModel(rightInner);
                }
                model.models.posts.models['rightPost'] = rightPost;

                if (capPlateMode === 'yes' || capPlateMode === true) {
                    const capT = parseFloat(capPlateThickness) || 0.25;
                    const capW = parseFloat(capPlateWidth) || rightPostW;
                    const capRight = {
                        models: { outer: new makerjs.models.Rectangle(capW, capT) },
                        origin: [length - rightPostW / 2 - capW / 2, fenceHeight]
                    };
                    if (!model.models.capPlates) model.models.capPlates = { models: {} };
                    model.models.capPlates.models['capRight'] = capRight;
                }
            }

            // 3. Top Runner
            if (topRailType !== 'none') {
                const topOuter = [
                    [0, fenceHeight],
                    [leftPostW, fenceHeight - topRailH],
                    [length - rightPostW, fenceHeight - topRailH],
                    [length, fenceHeight]
                ];
                const topInner = [
                    [topT, fenceHeight - topT],
                    [leftPostW - topT, fenceHeight - topRailH + topT],
                    [length - rightPostW + topT, fenceHeight - topRailH + topT],
                    [length - topT, fenceHeight - topT]
                ];

                const topRail = { models: {} };
                topRail.models.outer = createPolygonModel(topOuter);
                if (topRailType === 'hss_rect' && topRailH > 2 * topT) {
                    topRail.models.inner = createPolygonModel(topInner);
                }
                model.models.rails.models['topRail'] = topRail;
            }

            // 4. Bottom Runner
            if (botRailType !== 'none') {
                const botOuter = [
                    [0, 0],
                    [leftPostW, botRailH],
                    [length - rightPostW, botRailH],
                    [length, 0]
                ];
                const botInner = [
                    [botT, botT],
                    [leftPostW - botT, botRailH - botT],
                    [length - rightPostW + botT, botRailH - botT],
                    [length - botT, botT]
                ];

                const botRail = { models: {} };
                botRail.models.outer = createPolygonModel(botOuter);
                if (botRailType === 'hss_rect' && botRailH > 2 * botT) {
                    botRail.models.inner = createPolygonModel(botInner);
                }
                model.models.rails.models['botRail'] = botRail;
            }

            // 5. Mid Runner (butt joint between vertical side runners)
            if (midRailType !== 'none') {
                const midRail = { models: {} };
                const midY = botRailH + midRailGap;
                const midLen = length - leftPostW - rightPostW;
                
                midRail.models.outer = new makerjs.models.Rectangle(midLen, midRailH);
                midRail.models.outer.origin = [leftPostW, midY];
                
                const midT = 0.12;
                if (midRailType === 'hss_rect' && midRailH > 2 * midT) {
                    midRail.models.inner = new makerjs.models.Rectangle(midLen, midRailH - 2 * midT);
                    midRail.models.inner.origin = [leftPostW, midY + midT];
                }
                model.models.rails.models['midRail'] = midRail;
            }

            // 6. Kick Plate (Sheet metal plate)
            let actualKpH = parseFloat(kickPlateH) || 10.0;
            let kpY = 0;
            let kpW = length;
            let kpX = 0;

            if (kickPlate && kickPlate !== 'none') {
                model.models.kickPlate = { models: {} };
                const isOuter = (kickPlateWeld === 'outer');
                
                if (isOuter) {
                    // Outer Corner to Outer Corner (Left Runner to Right Runner, Bottom Runner to Mid Runner or 10")
                    kpX = 0;
                    kpW = length;
                    kpY = 0; // Starts at bottom corner of bottom runner
                    actualKpH = (midRailType !== 'none') ? (botRailH + midRailGap + midRailH) : (parseFloat(kickPlateH) || 10.0);
                } else {
                    // Inner Fit (Welded inside 4 inner corners of frame)
                    kpX = leftPostW;
                    kpW = Math.max(1, length - leftPostW - rightPostW);
                    kpY = botRailH; // Starts on top of bottom runner inner corner
                    actualKpH = (midRailType !== 'none') ? midRailGap : (parseFloat(kickPlateH) || 10.0);
                }

                model.models.kickPlate.models.plate = new makerjs.models.Rectangle(kpW, actualKpH);
                model.models.kickPlate.models.plate.origin = [kpX, kpY];
            }

            const strMesh = String(meshType || infillType || '').toLowerCase();
            const isWwmKind = strMesh.includes('wwm');
            const isXfKind = strMesh.includes('xf');
            const hasFlatBar = isWwmKind || isXfKind;
            const meshKind = isWwmKind ? 'wwm' : (isXfKind ? 'xf' : 'none');
            const fbW = hasFlatBar ? 1.0 : 0.0; // 1" flat bar width when mesh present

            // 7. Vertical Pickets
            const hasMid = (midRailType !== 'none');
            const hasKP = (kickPlate && kickPlate !== 'none');
            const isOuter = (kickPlateWeld === 'outer');
            const kpTopY = isOuter ? actualKpH : (botRailH + actualKpH);
            const midY_bot = botRailH + midRailGap;
            const midY_top = botRailH + midRailGap + midRailH;

            const spanCenterDist = (length - rightPostW / 2) - (leftPostW / 2);
            const targetSpacing = picketSpacing;
            const numPickets = (picketType !== 'none' && targetSpacing > 0) ? Math.max(0, Math.ceil((spanCenterDist - targetSpacing) / targetSpacing)) : 0;

            if (picketType !== 'none' && numPickets > 0) {
                const endGap = (spanCenterDist - (numPickets - 1) * targetSpacing) / 2;
                const pickT = 0.08;
                
                for (let i = 0; i < numPickets; i++) {
                    const px_center = (leftPostW / 2) + endGap + i * targetSpacing;
                    const px = px_center - picketW / 2;
                    const picket = { models: {} };

                    if (hasMid) {
                        // Mid runner is present:
                        // 1. Upper Picket segment (from top of mid runner to top runner)
                        const upperY0 = midY_top;
                        const upperY1 = fenceHeight - topRailH;
                        const upperH = Math.max(1, upperY1 - upperY0);

                        picket.models.upper = new makerjs.models.Rectangle(picketW, upperH);
                        picket.models.upper.origin = [px, upperY0];

                        if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                            picket.models.innerUpper = new makerjs.models.Rectangle(picketW - 2 * pickT, upperH);
                            picket.models.innerUpper.origin = [px + pickT, upperY0];
                        }

                        // 2. Lower Picket segment (only when pickets pass through mid runner, and not hidden by kick plate)
                        if (picketMidJoint !== 'weld_top' || midRailExtraPickets === 'yes') {
                            const lowerY0 = hasKP ? Math.max(botRailH, kpTopY) : botRailH;
                            const lowerY1 = midY_bot;
                            if (lowerY1 > lowerY0 + 0.1) {
                                const lowerH = lowerY1 - lowerY0;
                                picket.models.lower = new makerjs.models.Rectangle(picketW, lowerH);
                                picket.models.lower.origin = [px, lowerY0];

                                if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                                    picket.models.innerLower = new makerjs.models.Rectangle(picketW - 2 * pickT, lowerH);
                                    picket.models.innerLower.origin = [px + pickT, lowerY0];
                                }
                            }
                        }
                    } else {
                        // No mid runner:
                        const pickY0 = hasKP ? Math.max(botRailH, kpTopY) : botRailH;
                        const pickY1 = fenceHeight - topRailH;
                        const infillH = Math.max(1, pickY1 - pickY0);

                        picket.models.outer = new makerjs.models.Rectangle(picketW, infillH);
                        picket.models.outer.origin = [px, pickY0];

                        if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                            picket.models.inner = new makerjs.models.Rectangle(picketW - 2 * pickT, infillH);
                            picket.models.inner.origin = [px + pickT, pickY0];
                        }
                    }

                    model.models.pickets.models['p' + i] = picket;
                }
            }

            // 7B. Puppy Pickets (if active)
            const hasPuppyPickets = (puppyPickets && puppyPickets !== 'no');
            if (hasPuppyPickets && picketType !== 'none' && numPickets > 0) {
                model.models.puppyPickets = { models: {} };
                const puppyLen = parseFloat(puppyPicketsLength) || 16.0;
                
                const puppyCenters = [];
                const endGap = (spanCenterDist - (numPickets - 1) * targetSpacing) / 2;
                const pickT = 0.08;
                const puppyPSpc = parseFloat(puppyPicketsSpacing) || 2.0;

                // Left end gap puppy picket
                const px_0 = leftPostW / 2 + endGap;
                const clearLeftGap = (px_0 - picketW / 2) - leftPostW;
                if (clearLeftGap > puppyPSpc * 0.9) {
                    puppyCenters.push((leftPostW + px_0 - picketW / 2) / 2);
                }

                // Intermediate gaps
                for (let i = 0; i < numPickets - 1; i++) {
                    const x_i = leftPostW / 2 + endGap + i * targetSpacing;
                    puppyCenters.push(x_i + targetSpacing / 2);
                }

                // Right end gap puppy picket
                const x_last = leftPostW / 2 + endGap + (numPickets - 1) * targetSpacing;
                const clearRightGap = (length - rightPostW) - (x_last + picketW / 2);
                if (clearRightGap > puppyPSpc * 0.9) {
                    puppyCenters.push(((length - rightPostW) + x_last + picketW / 2) / 2);
                }

                const puppyTopY = botRailH + puppyLen;

                for (let j = 0; j < puppyCenters.length; j++) {
                    const px_center = puppyCenters[j];
                    const px = px_center - picketW / 2;
                    const puppy = { models: {} };

                    if (hasMid) {
                        if (picketMidJoint === 'weld_top') {
                            // Weld on top of mid runner: both main pickets and puppy pickets sit and weld on top of mid runner
                            const upperH = puppyLen;
                            puppy.models.upper = new makerjs.models.Rectangle(picketW, upperH);
                            puppy.models.upper.origin = [px, midY_top];

                            if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                                puppy.models.innerUpper = new makerjs.models.Rectangle(picketW - 2 * pickT, upperH);
                                puppy.models.innerUpper.origin = [px + pickT, midY_top];
                            }
                        } else {
                            // Pass through mid runner:
                            // 1. If puppy picket extends above the mid runner:
                            if (puppyTopY > midY_top) {
                                const upperH = puppyTopY - midY_top;
                                puppy.models.upper = new makerjs.models.Rectangle(picketW, upperH);
                                puppy.models.upper.origin = [px, midY_top];

                                if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                                    puppy.models.innerUpper = new makerjs.models.Rectangle(picketW - 2 * pickT, upperH);
                                    puppy.models.innerUpper.origin = [px + pickT, midY_top];
                                }
                            }

                            // 2. Portion below mid runner (if not covered by kick plate)
                            const lowerY0 = hasKP ? Math.max(botRailH, kpTopY) : botRailH;
                            const lowerY1 = Math.min(puppyTopY, midY_bot);
                            if (lowerY1 > lowerY0 + 0.1) {
                                const lowerH = lowerY1 - lowerY0;
                                puppy.models.lower = new makerjs.models.Rectangle(picketW, lowerH);
                                puppy.models.lower.origin = [px, lowerY0];

                                if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                                    puppy.models.innerLower = new makerjs.models.Rectangle(picketW - 2 * pickT, lowerH);
                                    puppy.models.innerLower.origin = [px + pickT, lowerY0];
                                }
                            }
                        }
                    } else {
                        // No mid runner:
                        const pY0 = hasKP ? Math.max(botRailH, kpTopY) : botRailH;
                        const pY1 = puppyTopY;
                        if (pY1 > pY0 + 0.1) {
                            const puppyH = pY1 - pY0;
                            puppy.models.outer = new makerjs.models.Rectangle(picketW, puppyH);
                            puppy.models.outer.origin = [px, pY0];

                            if (picketType === 'hss_rect' && picketW > 2 * pickT) {
                                puppy.models.inner = new makerjs.models.Rectangle(picketW - 2 * pickT, puppyH);
                                puppy.models.inner.origin = [px + pickT, pY0];
                            }
                        }
                    }

                    model.models.puppyPickets.models['pp' + j] = puppy;
                }
            }

            // 8. Perimeter Flat Bar (FB 1/8" x 1") & Scalloped Revision Cloud Box
            if (hasFlatBar) {
                model.models.mesh = { paths: {}, models: {} };
                
                const meshLeftX = leftPostW;
                const meshRightX = length - rightPostW;
                let meshMinY = hasKP ? Math.max(botRailH, kpTopY) : botRailH;
                if (hasMid && midY_top > meshMinY) {
                    meshMinY = midY_top;
                }
                const meshMaxY = Math.max(meshMinY + 1, fenceHeight - topRailH);
                const meshW = meshRightX - meshLeftX;
                const meshH = meshMaxY - meshMinY;
                
                // Perimeter Flat Bar (FB 1/8" x 1") Retainer Frame around mesh
                const fbFrame = { models: {} };
                fbFrame.models.topFB = new makerjs.models.Rectangle(meshW, fbW);
                fbFrame.models.topFB.origin = [meshLeftX, meshMaxY - fbW];
                
                fbFrame.models.botFB = new makerjs.models.Rectangle(meshW, fbW);
                fbFrame.models.botFB.origin = [meshLeftX, meshMinY];
                
                fbFrame.models.leftFB = new makerjs.models.Rectangle(fbW, meshH - 2 * fbW);
                fbFrame.models.leftFB.origin = [meshLeftX, meshMinY + fbW];
                
                fbFrame.models.rightFB = new makerjs.models.Rectangle(fbW, meshH - 2 * fbW);
                fbFrame.models.rightFB.origin = [meshRightX - fbW, meshMinY + fbW];
                
                model.models.mesh.models.fbFrame = fbFrame;
                
                const fillLeftX = meshLeftX + fbW;
                const fillRightX = meshRightX - fbW;
                const fillMinY = meshMinY + fbW;
                const fillMaxY = meshMaxY - fbW;
                const step = Math.max(0.5, parseFloat(meshOpening) || 2.0);
                

                
                // Centered Revision Cloud Box (4 outward semicircular arcs sides)
                const openW = fillRightX - fillLeftX;
                const openH = fillMaxY - fillMinY;
                const cloudBoxW = Math.min(32.0, Math.max(16.0, openW * 0.45));
                const cloudBoxH = Math.min(32.0, Math.max(16.0, openH * 0.45));
                
                const centerX = (fillLeftX + fillRightX) / 2;
                const centerY = (fillMinY + fillMaxY) / 2;
                
                const bMinX = centerX - cloudBoxW / 2;
                const bMaxX = centerX + cloudBoxW / 2;
                const bMinY = centerY - cloudBoxH / 2;
                const bMaxY = centerY + cloudBoxH / 2;
                
                const cloudArcs = { paths: {} };
                const numArcsX = 8;
                const numArcsY = 8;
                const stepX = cloudBoxW / numArcsX;
                const stepY = cloudBoxH / numArcsY;
                
                // 1. Top Side Arcs (curving upward +Y)
                for (let i = 0; i < numArcsX; i++) {
                    const cx = bMinX + (i + 0.5) * stepX;
                    const cy = bMaxY;
                    cloudArcs.paths['cTop' + i] = new makerjs.paths.Arc([cx, cy], stepX / 2, 0, 180);
                }
                
                // 2. Right Side Arcs (curving rightward +X)
                for (let i = 0; i < numArcsY; i++) {
                    const cx = bMaxX;
                    const cy = bMinY + (i + 0.5) * stepY;
                    cloudArcs.paths['cRight' + i] = new makerjs.paths.Arc([cx, cy], stepY / 2, 270, 450);
                }
                
                // 3. Bottom Side Arcs (curving downward -Y)
                for (let i = 0; i < numArcsX; i++) {
                    const cx = bMinX + (i + 0.5) * stepX;
                    const cy = bMinY;
                    cloudArcs.paths['cBot' + i] = new makerjs.paths.Arc([cx, cy], stepX / 2, 180, 360);
                }
                
                // 4. Left Side Arcs (curving leftward -X)
                for (let i = 0; i < numArcsY; i++) {
                    const cx = bMinX;
                    const cy = bMinY + (i + 0.5) * stepY;
                    cloudArcs.paths['cLeft' + i] = new makerjs.paths.Arc([cx, cy], stepY / 2, 90, 270);
                }
                
                model.models.mesh.models.cloudBoundary = cloudArcs;
                
                if (meshKind === 'wwm') {
                    // WWM: Welded Wire Mesh (Square / Rectangular Grid strictly inside Centered Cloud Box)
                    let vCount = 0;
                    for (let x = bMinX + step; x < bMaxX; x += step) {
                        model.models.mesh.paths['mv' + vCount] = new makerjs.paths.Line([x, bMinY], [x, bMaxY]);
                        vCount++;
                    }
                    let hCount = 0;
                    for (let y = bMinY + step; y < bMaxY; y += step) {
                        model.models.mesh.paths['mh' + hCount] = new makerjs.paths.Line([bMinX, y], [bMaxX, y]);
                        hCount++;
                    }
                } else if (meshKind === 'xf') {
                    // XF: Expanded Metal (Diamond Pattern inside Centered Cloud Box)
                    let dCount = 0;
                    const stepVal = Math.max(1.0, parseFloat(meshOpening) || 2.0);
                    
                    // Family 1: +45-degree diagonal lines (y = x + c => c = y - x)
                    const minC1 = bMinY - bMaxX;
                    const maxC1 = bMaxY - bMinX;
                    for (let c = minC1 + stepVal; c < maxC1; c += stepVal) {
                        const x1 = Math.max(bMinX, bMinY - c);
                        const x2 = Math.min(bMaxX, bMaxY - c);
                        if (x1 < x2) {
                            const y1 = x1 + c;
                            const y2 = x2 + c;
                            model.models.mesh.paths['md1_' + dCount] = new makerjs.paths.Line([x1, y1], [x2, y2]);
                            dCount++;
                        }
                    }
                    
                    // Family 2: -45-degree diagonal lines (y = -x + c => c = y + x)
                    dCount = 0;
                    const minC2 = bMinX + bMinY;
                    const maxC2 = bMaxX + bMaxY;
                    for (let c = minC2 + stepVal; c < maxC2; c += stepVal) {
                        const x1 = Math.max(bMinX, c - bMaxY);
                        const x2 = Math.min(bMaxX, c - bMinY);
                        if (x1 < x2) {
                            const y1 = -x1 + c;
                            const y2 = -x2 + c;
                            model.models.mesh.paths['md2_' + dCount] = new makerjs.paths.Line([x1, y1], [x2, y2]);
                            dCount++;
                        }
                    }
                }
            }

            // 9. Siding (Corrugated or Flat Skin)
            if (sidingType && sidingType !== 'none') {
                model.models.siding = { paths: {}, models: {} };
                const sX0 = leftPostW;
                const sX1 = length - rightPostW;
                const sY0 = botRailH;
                const sY1 = fenceHeight - topRailH;

                if (sidingType === 'corrugated' || sidingType === 'decking') {
                    // 1. Outer boundary of continuous metal deck sheet
                    model.models.siding.models.sheet = new makerjs.models.Rectangle(sX1 - sX0, sY1 - sY0);
                    model.models.siding.models.sheet.origin = [sX0, sY0];

                    const pitch = 2.5; // Standard pitch
                    let rIdx = 0;

                    if (fluteOrientation === 'horizontal') {
                        // Horizontal flutes running left-to-right
                        for (let ry = sY0 + 0.5; ry < sY1 - 0.5; ry += pitch) {
                            const crestH = 1.25;
                            const webOffset = 0.25;
                            model.models.siding.paths['crestB_' + rIdx] = new makerjs.paths.Line([sX0, ry], [sX1, ry]);
                            if (ry + crestH < sY1) {
                                model.models.siding.paths['crestT_' + rIdx] = new makerjs.paths.Line([sX0, ry + crestH], [sX1, ry + crestH]);
                            }
                            if (ry + webOffset < sY1) {
                                model.models.siding.paths['crease_' + rIdx] = new makerjs.paths.Line([sX0, ry + webOffset], [sX1, ry + webOffset]);
                            }
                            rIdx++;
                        }

                        // Fastener ticks along side posts
                        let fIdx = 0;
                        for (let fy = sY0 + 2.5; fy < sY1 - 1.0; fy += 5.0) {
                            model.models.siding.paths['fastenerLeft_' + fIdx] = new makerjs.paths.Line([sX0 + 0.5, fy], [sX0 + 1.1, fy]);
                            model.models.siding.paths['fastenerRight_' + fIdx] = new makerjs.paths.Line([sX1 - 1.1, fy], [sX1 - 0.5, fy]);
                            fIdx++;
                        }
                    } else {
                        // Vertical flutes running top-to-bottom
                        for (let rx = sX0 + 0.5; rx < sX1 - 0.5; rx += pitch) {
                            const crestW = 1.25;
                            const webOffset = 0.25;
                            model.models.siding.paths['crestL_' + rIdx] = new makerjs.paths.Line([rx, sY0], [rx, sY1]);
                            if (rx + crestW < sX1) {
                                model.models.siding.paths['crestR_' + rIdx] = new makerjs.paths.Line([rx + crestW, sY0], [rx + crestW, sY1]);
                            }
                            if (rx + webOffset < sX1) {
                                model.models.siding.paths['crease_' + rIdx] = new makerjs.paths.Line([rx + webOffset, sY0], [rx + webOffset, sY1]);
                            }
                            rIdx++;
                        }

                        // Fastener ticks along top and bottom rails
                        let fIdx = 0;
                        for (let fx = sX0 + 2.5; fx < sX1 - 1.0; fx += 5.0) {
                            model.models.siding.paths['fastenerTopA_' + fIdx] = new makerjs.paths.Line([fx - 0.3, sY1 - 0.8], [fx + 0.3, sY1 - 0.8]);
                            model.models.siding.paths['fastenerTopB_' + fIdx] = new makerjs.paths.Line([fx, sY1 - 1.1], [fx, sY1 - 0.5]);
                            model.models.siding.paths['fastenerBotA_' + fIdx] = new makerjs.paths.Line([fx - 0.3, sY0 + 0.8], [fx + 0.3, sY0 + 0.8]);
                            model.models.siding.paths['fastenerBotB_' + fIdx] = new makerjs.paths.Line([fx, sY0 + 0.5], [fx, sY0 + 1.1]);
                            fIdx++;
                        }
                    }

                    // Splicing check along span (length) and cross (width) directions
                    const spanDim = (fluteOrientation === 'horizontal') ? (sX1 - sX0) : (sY1 - sY0);
                    const crossDim = (fluteOrientation === 'horizontal') ? (sY1 - sY0) : (sX1 - sX0);
                    const maxDeckLenInches = (parseFloat(maxDeckLen) || 24.0) * 12.0;
                    const maxDeckWidthInches = parseFloat(maxDeckWidth) || 36.0;

                    if (spanDim > maxDeckLenInches) {
                        const numSplices = Math.ceil(spanDim / maxDeckLenInches);
                        const segH = spanDim / numSplices;
                        for (let s = 1; s < numSplices; s++) {
                            if (fluteOrientation === 'horizontal') {
                                const spliceX = sX0 + s * segH;
                                model.models.siding.paths['spliceL_' + s] = new makerjs.paths.Line([spliceX, sY0], [spliceX, sY1]);
                            } else {
                                const spliceY = sY0 + s * segH;
                                model.models.siding.paths['spliceL_' + s] = new makerjs.paths.Line([sX0, spliceY], [sX1, spliceY]);
                            }
                        }
                    }

                    if (crossDim > maxDeckWidthInches) {
                        const numWidthPanels = Math.ceil(crossDim / maxDeckWidthInches);
                        const segW = crossDim / numWidthPanels;
                        for (let w = 1; w < numWidthPanels; w++) {
                            if (fluteOrientation === 'horizontal') {
                                const jointY = sY0 + w * segW;
                                model.models.siding.paths['jointW_' + w] = new makerjs.paths.Line([sX0, jointY], [sX1, jointY]);
                            } else {
                                const jointX = sX0 + w * segW;
                                model.models.siding.paths['jointW_' + w] = new makerjs.paths.Line([jointX, sY0], [jointX, sY1]);
                            }
                        }
                    }
                } else if (sidingType === 'flat_skin') {
                    model.models.siding.models.skin = new makerjs.models.Rectangle(sX1 - sX0, sY1 - sY0);
                    model.models.siding.models.skin.origin = [sX0, sY0];
                }

                // 9.5 Deck Retainers / Stops (Perimeter Flat Bar or Angle Stops)
                if (deckRetainer && deckRetainer !== 'none') {
                    model.models.retainers = { paths: {}, models: {} };
                    const retW = (deckRetainer === 'angle') ? 1.5 : 1.0;
                    const rLeftX = (deckPlacement === 'inside') ? leftPostW : 0;
                    const rRightX = (deckPlacement === 'inside') ? (length - rightPostW) : length;
                    const rMinY = (deckPlacement === 'inside') ? botRailH : 0;
                    const rMaxY = (deckPlacement === 'inside') ? (fenceHeight - topRailH) : fenceHeight;
                    const rWidth = rRightX - rLeftX;
                    const rHeight = rMaxY - rMinY;

                    // Top Retainer
                    model.models.retainers.models.topRet = new makerjs.models.Rectangle(rWidth, retW);
                    model.models.retainers.models.topRet.origin = [rLeftX, rMaxY - retW];

                    // Bottom Retainer
                    model.models.retainers.models.botRet = new makerjs.models.Rectangle(rWidth, retW);
                    model.models.retainers.models.botRet.origin = [rLeftX, rMinY];

                    // Left Retainer
                    model.models.retainers.models.leftRet = new makerjs.models.Rectangle(retW, Math.max(1, rHeight - 2 * retW));
                    model.models.retainers.models.leftRet.origin = [rLeftX, rMinY + retW];

                    // Right Retainer
                    model.models.retainers.models.rightRet = new makerjs.models.Rectangle(retW, Math.max(1, rHeight - 2 * retW));
                    model.models.retainers.models.rightRet.origin = [rRightX - retW, rMinY + retW];
                }
            }

            // 10. Bracing (Diagonal / X-Brace)
            if (braceType && braceType !== 'none') {
                model.models.bracing = { paths: {}, models: {} };
                const isOuterBrace = (braceWeld === 'outer');
                const bX0 = isOuterBrace ? 0 : leftPostW;
                const bX1 = isOuterBrace ? length : (length - rightPostW);
                const bY0 = isOuterBrace ? 0 : botRailH;
                const bY1 = isOuterBrace ? fenceHeight : (fenceHeight - topRailH);
                const bW = parseFloat(braceW) || 2.0;

                const W = bX1 - bX0;
                const H = bY1 - bY0;
                const D = Math.hypot(W, H);

                if (D > 1 && W > 0 && H > 0) {
                    const xOffset = (bW * D) / (2 * H);
                    const yOffset = (bW * D) / (2 * W);

                    // 1. Continuous Diagonal BL to TR (from (bX0, bY0) to (bX1, bY1))
                    if (braceType === 'x_brace' || braceType === 'diag_tr_bl') {
                        const diagBL_TR = { paths: {} };
                        // Upper-left side line
                        const pUL_start = [bX0, bY0 + yOffset];
                        const pUL_end = [bX1 - xOffset, bY1];
                        diagBL_TR.paths['sideUL'] = new makerjs.paths.Line(pUL_start, pUL_end);

                        // Lower-right side line
                        const pLR_start = [bX0 + xOffset, bY0];
                        const pLR_end = [bX1, bY1 - yOffset];
                        diagBL_TR.paths['sideLR'] = new makerjs.paths.Line(pLR_start, pLR_end);

                        // Corner weld bevel cuts / caps
                        diagBL_TR.paths['capBL_vert'] = new makerjs.paths.Line([bX0, bY0], pUL_start);
                        diagBL_TR.paths['capBL_horiz'] = new makerjs.paths.Line([bX0, bY0], pLR_start);
                        diagBL_TR.paths['capTR_horiz'] = new makerjs.paths.Line(pUL_end, [bX1, bY1]);
                        diagBL_TR.paths['capTR_vert'] = new makerjs.paths.Line(pLR_end, [bX1, bY1]);

                        model.models.bracing.models['diagBL_TR'] = diagBL_TR;
                    }

                    // 2. Opposing Diagonal TL to BR
                    if (braceType === 'x_brace') {
                        // Split into 2 half segments welded to the face of continuous diagonal
                        const xc = (bX0 + bX1) / 2;
                        const yc = (bY0 + bY1) / 2;

                        // Upper-Left Segment (Top-Left corner to Continuous Tube face)
                        const diagUpper = { paths: {} };
                        const pUR_start = [bX0 + xOffset, bY1];
                        const pUR_center = [xc, yc + yOffset];
                        const pLL_start = [bX0, bY1 - yOffset];
                        const pLL_center = [xc - xOffset, yc];

                        diagUpper.paths['sideUR'] = new makerjs.paths.Line(pUR_start, pUR_center);
                        diagUpper.paths['sideLL'] = new makerjs.paths.Line(pLL_start, pLL_center);
                        diagUpper.paths['capTL_vert'] = new makerjs.paths.Line(pLL_start, [bX0, bY1]);
                        diagUpper.paths['capTL_horiz'] = new makerjs.paths.Line([bX0, bY1], pUR_start);
                        diagUpper.paths['weldCenter'] = new makerjs.paths.Line(pLL_center, pUR_center);
                        model.models.bracing.models['diagUpper'] = diagUpper;

                        // Lower-Right Segment (Continuous Tube face to Bottom-Right corner)
                        const diagLower = { paths: {} };
                        const pUR_lowerCenter = [xc + xOffset, yc];
                        const pUR_lowerEnd = [bX1, bY0 + yOffset];
                        const pLL_lowerCenter = [xc, yc - yOffset];
                        const pLL_lowerEnd = [bX1 - xOffset, bY0];

                        diagLower.paths['sideUR'] = new makerjs.paths.Line(pUR_lowerCenter, pUR_lowerEnd);
                        diagLower.paths['sideLL'] = new makerjs.paths.Line(pLL_lowerCenter, pLL_lowerEnd);
                        diagLower.paths['weldCenter'] = new makerjs.paths.Line(pLL_lowerCenter, pUR_lowerCenter);
                        diagLower.paths['capBR_horiz'] = new makerjs.paths.Line(pLL_lowerEnd, [bX1, bY0]);
                        diagLower.paths['capBR_vert'] = new makerjs.paths.Line([bX1, bY0], pUR_lowerEnd);
                        model.models.bracing.models['diagLower'] = diagLower;

                    } else if (braceType === 'diag_tl_br') {
                        // Single unbroken TL-to-BR diagonal
                        const diagTL_BR = { paths: {} };
                        const pUR_start = [bX0 + xOffset, bY1];
                        const pUR_end = [bX1, bY0 + yOffset];
                        diagTL_BR.paths['sideUR'] = new makerjs.paths.Line(pUR_start, pUR_end);

                        const pLL_start = [bX0, bY1 - yOffset];
                        const pLL_end = [bX1 - xOffset, bY0];
                        diagTL_BR.paths['sideLL'] = new makerjs.paths.Line(pLL_start, pLL_end);

                        diagTL_BR.paths['capTL_vert'] = new makerjs.paths.Line(pLL_start, [bX0, bY1]);
                        diagTL_BR.paths['capTL_horiz'] = new makerjs.paths.Line([bX0, bY1], pUR_start);
                        diagTL_BR.paths['capBR_horiz'] = new makerjs.paths.Line(pLL_end, [bX1, bY0]);
                        diagTL_BR.paths['capBR_vert'] = new makerjs.paths.Line([bX1, bY0], pUR_end);

                        model.models.bracing.models['diagTL_BR'] = diagTL_BR;
                    }

                    if (braceType === 'horizontal') {
                        const midY = (bY0 + bY1) / 2 - bW / 2;
                        model.models.bracing.models['horiz'] = new makerjs.models.Rectangle(W, bW);
                        model.models.bracing.models['horiz'].origin = [bX0, midY];
                    }
                }
            }

        } else {
            // FENCE: True fence assembly with vertical POSTS on left and right, and horizontal runners connecting between posts (no 45-degree corner miters!)
            const pt = 0.12; 
            
            const safeTopGap = (typeof topGap !== 'undefined' && !isNaN(parseFloat(topGap))) ? Math.max(0, parseFloat(topGap)) : 0;
            const panelTopY = fenceHeight;
            const postTopY = fenceHeight + safeTopGap;
            const postBottomY = postTopY - postHeight;

            // 1. Left Post (vertical column from bottom to top) - only rendered if wantLeftPost !== 'no'
            if (leftPostType !== 'none' && wantLeftPost !== 'no') {
                const leftPost = { models: {}, paths: {} };
                leftPost.models.outer = new makerjs.models.Rectangle(leftPostW, postHeight);
                if (leftPostType === 'hss_rect' && leftPostW > 2 * pt) {
                    leftPost.models.inner = new makerjs.models.Rectangle(leftPostW - 2 * pt, postHeight - 2 * pt);
                    leftPost.models.inner.origin = [pt, pt];
                }
                leftPost.origin = [0, postBottomY];
                model.models.posts.models['leftPost'] = leftPost;

                if (includeBasePlates === 'yes') {
                    const bp = {
                        models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                        paths: {
                            h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                            h2: new makerjs.paths.Circle([bpW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                        }
                    };
                    bp.origin = [leftPostW/2 - bpW/2, postBottomY - bpH];
                    model.models.basePlates.models['bpLeft'] = bp;
                }

                if (capPlateMode === 'yes' || capPlateMode === true) {
                    const capT = parseFloat(capPlateThickness) || 0.25;
                    const capW = parseFloat(capPlateWidth) || leftPostW;
                    const capLeft = {
                        models: { outer: new makerjs.models.Rectangle(capW, capT) },
                        origin: [leftPostW / 2 - capW / 2, postTopY]
                    };
                    if (!model.models.capPlates) model.models.capPlates = { models: {} };
                    model.models.capPlates.models['capLeft'] = capLeft;
                }
            }

            // 2. Right Post (vertical column from bottom to top) - only rendered if wantRightPost !== 'no'
            if (rightPostType !== 'none' && wantRightPost !== 'no') {
                const rightPost = { models: {}, paths: {} };
                rightPost.models.outer = new makerjs.models.Rectangle(rightPostW, postHeight);
                if (rightPostType === 'hss_rect' && rightPostW > 2 * pt) {
                    rightPost.models.inner = new makerjs.models.Rectangle(rightPostW - 2 * pt, postHeight - 2 * pt);
                    rightPost.models.inner.origin = [pt, pt];
                }
                const rightPx = length - rightPostW;
                const rightPyBase = length * tan;
                rightPost.origin = [rightPx, rightPyBase + postBottomY];
                model.models.posts.models['rightPost'] = rightPost;

                if (includeBasePlates === 'yes') {
                    const bp = {
                        models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                        paths: {
                            h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                            h2: new makerjs.paths.Circle([bpW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                        }
                    };
                    bp.origin = [rightPx + rightPostW/2 - bpW/2, rightPyBase + postBottomY - bpH];
                    makerjs.model.rotate(bp, slope, [rightPx + rightPostW/2, rightPyBase + postBottomY]);
                    model.models.basePlates.models['bpRight'] = bp;
                }

                if (capPlateMode === 'yes' || capPlateMode === true) {
                    const capT = parseFloat(capPlateThickness) || 0.25;
                    const capW = parseFloat(capPlateWidth) || rightPostW;
                    const capRight = {
                        models: { outer: new makerjs.models.Rectangle(capW, capT) },
                        origin: [rightPx + rightPostW / 2 - capW / 2, rightPyBase + postTopY]
                    };
                    if (safeSlope !== 0) {
                        makerjs.model.rotate(capRight, safeSlope, [rightPx + rightPostW / 2, rightPyBase + postTopY]);
                    }
                    if (!model.models.capPlates) model.models.capPlates = { models: {} };
                    model.models.capPlates.models['capRight'] = capRight;
                }
            }

            const actualLeftPostW = (wantLeftPost !== 'no' && leftPostType !== 'none') ? leftPostW : 0;
            const actualRightPostW = (wantRightPost !== 'no' && rightPostType !== 'none') ? rightPostW : 0;
            const clearSpan = length - actualLeftPostW - actualRightPostW;
            const x0_span = actualLeftPostW;
            const x1_span = length - actualRightPostW;

            const resolvedMidCenters = (midPostCenters && Array.isArray(midPostCenters) && midPostCenters.length > 0)
                ? midPostCenters
                : (midPostCount > 0 ? (() => {
                    const centers = [];
                    const centerDist = (length - actualLeftPostW - actualRightPostW);
                    const spanSpacing = centerDist / (midPostCount + 1);
                    for (let i = 1; i <= midPostCount; i++) {
                        centers.push(actualLeftPostW + i * spanSpacing);
                    }
                    return centers;
                })() : []);

            const topY = panelTopY - topRailH;
            const midPostH = Math.max(1, topY - postBottomY);

            if (resolvedMidCenters.length > 0) {
                for (let i = 1; i <= resolvedMidCenters.length; i++) {
                    const midCx = resolvedMidCenters[i - 1];
                    const midPx = midCx - midPostW/2;
                    const midPyBase = midCx * tan;
                    
                    const midPost = { models: {}, paths: {} };
                    if (safeSlope !== 0) {
                        const p1_b = [midPx, postBottomY + midPx * tan];
                        const p2_b = [midPx + midPostW, postBottomY + (midPx + midPostW) * tan];
                        const p2_t = [midPx + midPostW, topY + (midPx + midPostW) * tan];
                        const p1_t = [midPx, topY + midPx * tan];
                        midPost.models.outer = createPolygonModel([p1_b, p2_b, p2_t, p1_t]);
                        if (midPostType === 'hss_rect' && midPostW > 2 * pt && midPostH > 2 * pt) {
                            const ip1_b = [midPx + pt, postBottomY + pt + (midPx + pt) * tan];
                            const ip2_b = [midPx + midPostW - pt, postBottomY + pt + (midPx + midPostW - pt) * tan];
                            const ip2_t = [midPx + midPostW - pt, topY - pt + (midPx + midPostW - pt) * tan];
                            const ip1_t = [midPx + pt, topY - pt + (midPx + pt) * tan];
                            midPost.models.inner = createPolygonModel([ip1_b, ip2_b, ip2_t, ip1_t]);
                        }
                        midPost.origin = [0, 0];
                    } else {
                        midPost.models.outer = new makerjs.models.Rectangle(midPostW, midPostH);
                        if (midPostType === 'hss_rect' && midPostW > 2 * pt && midPostH > 2 * pt) {
                            midPost.models.inner = new makerjs.models.Rectangle(midPostW - 2 * pt, midPostH - 2 * pt);
                            midPost.models.inner.origin = [pt, pt];
                        }
                        midPost.origin = [midPx, postBottomY];
                    }
                    model.models.posts.models['midPost_' + i] = midPost;
                    
                    if (includeBasePlates === 'yes') {
                        const bp = {
                            models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                            paths: {
                                h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                                h2: new makerjs.paths.Circle([bpW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                            }
                        };
                        bp.origin = [midPx + midPostW/2 - bpW/2, midPyBase + postBottomY - bpH];
                        makerjs.model.rotate(bp, slope, [midPx + midPostW/2, midPyBase + postBottomY]);
                        model.models.basePlates.models['bpMid_' + i] = bp;
                    }


                }
            }

            const createSlopedRunner = (y0_base, h) => {
                const m = { models: {}, paths: {} };
                m.models.outer = createPolygonModel([
                    [x0_span, y0_base + x0_span * tan],
                    [x1_span, y0_base + x1_span * tan],
                    [x1_span, y0_base + h + x1_span * tan],
                    [x0_span, y0_base + h + x0_span * tan]
                ]);
                return m;
            };

            // 3. Top Runner (continuous horizontal runner sitting on top of mid posts, between end posts)
            if (topRailType !== 'none' && clearSpan > 0) {
                if (safeSlope !== 0) {
                    model.models.rails.models['topRail'] = createSlopedRunner(topY, topRailH);
                } else {
                    const topRail = { models: {}, paths: {} };
                    topRail.models.outer = new makerjs.models.Rectangle(clearSpan, topRailH);
                    if (topRailType === 'hss_rect' && topRailH > 2 * pt) {
                        topRail.models.inner = new makerjs.models.Rectangle(clearSpan, topRailH - 2 * pt);
                        topRail.models.inner.origin = [0, pt];
                    }
                    topRail.origin = [actualLeftPostW, topY];
                    model.models.rails.models['topRail'] = topRail;
                }
            }

            // Determine runner spans between posts for bottom and mid runners (framed into post sides)
            const runnerSpans = [];
            let curX = actualLeftPostW;
            if (resolvedMidCenters && resolvedMidCenters.length > 0) {
                resolvedMidCenters.forEach(midCx => {
                    const mpLeft = midCx - midPostW / 2;
                    const mpRight = midCx + midPostW / 2;
                    if (mpLeft > curX) {
                        runnerSpans.push({ startX: curX, endX: mpLeft });
                    }
                    curX = mpRight;
                });
            }
            const finalEndX = length - actualRightPostW;
            if (finalEndX > curX) {
                runnerSpans.push({ startX: curX, endX: finalEndX });
            }

            const createRunnerSegment = (xStart, xEnd, y0_base, h, railType) => {
                const w = xEnd - xStart;
                if (w <= 0.01) return null;
                const m = { models: {}, paths: {} };
                if (safeSlope !== 0) {
                    m.models.outer = createPolygonModel([
                        [xStart, y0_base + xStart * tan],
                        [xEnd, y0_base + xEnd * tan],
                        [xEnd, y0_base + h + xEnd * tan],
                        [xStart, y0_base + h + xStart * tan]
                    ]);
                    if (railType === 'hss_rect' && h > 2 * pt) {
                        m.models.inner = createPolygonModel([
                            [xStart, y0_base + pt + xStart * tan],
                            [xEnd, y0_base + pt + xEnd * tan],
                            [xEnd, y0_base + h - pt + xEnd * tan],
                            [xStart, y0_base + h - pt + xStart * tan]
                        ]);
                    }
                    m.origin = [0, 0];
                } else {
                    m.models.outer = new makerjs.models.Rectangle(w, h);
                    if (railType === 'hss_rect' && h > 2 * pt) {
                        m.models.inner = new makerjs.models.Rectangle(w, h - 2 * pt);
                        m.models.inner.origin = [0, pt];
                    }
                    m.origin = [xStart, y0_base];
                }
                return m;
            };

            // 4. Bottom Runner (horizontal runner segments framed between posts and welded to post sides)
            const hasPosts = (actualLeftPostW > 0 || actualRightPostW > 0 || resolvedMidCenters.length > 0);
            const botY = hasPosts ? ((typeof botRailElevation !== 'undefined' && !isNaN(parseFloat(botRailElevation))) ? parseFloat(botRailElevation) : 0) : 0;
            if (botRailType !== 'none' && runnerSpans.length > 0) {
                runnerSpans.forEach((span, idx) => {
                    const seg = createRunnerSegment(span.startX, span.endX, botY, botRailH, botRailType);
                    if (seg) {
                        const segName = (runnerSpans.length === 1) ? 'botRail' : ('botRail_' + idx);
                        model.models.rails.models[segName] = seg;
                        if (idx === 0) model.models.rails.models['botRail'] = seg;
                    }
                });
            }

            // 5. Mid Runner (horizontal runner segments framed between posts and welded to post sides)
            const midRailY = botY + botRailH + midRailGap;
            if (midRailType !== 'none' && runnerSpans.length > 0) {
                runnerSpans.forEach((span, idx) => {
                    const seg = createRunnerSegment(span.startX, span.endX, midRailY, midRailH, midRailType);
                    if (seg) {
                        const segName = (runnerSpans.length === 1) ? 'midRail' : ('midRail_' + idx);
                        model.models.rails.models[segName] = seg;
                        if (idx === 0) model.models.rails.models['midRail'] = seg;
                    }
                });
            }

            // 6. Vertical Pickets
            const hasMid = (midRailType !== 'none');
            const picketBottomY = (botRailType === 'none') ? (botY + 4) : (botY + botRailH);
            const picketTopY = (topRailType === 'none') ? panelTopY : (panelTopY - topRailH);
            const midY_bot = midRailY;
            const midY_top = midRailY + midRailH;

            const targetSpacing = picketSpacing;
            let numPickets = 0;
            let faceMargin = 0;

            const createPicketModel = (px_center) => {
                const px = px_center - picketW / 2;
                const picket = { models: {} };

                const curPicketBotY = picketBottomY + px_center * tan;
                const curPicketTopY = picketTopY + px_center * tan;
                const curMidY_bot = midY_bot + px_center * tan;
                const curMidY_top = midY_top + px_center * tan;

                if (hasMid) {
                    // Upper Picket: from top of mid runner to top runner (never inside mid runner)
                    const uY0 = curMidY_top;
                    const uY1 = curPicketTopY;
                    const uH = Math.max(1, uY1 - uY0);
                    picket.models.upper = new makerjs.models.Rectangle(picketW, uH);
                    picket.models.upper.origin = [px, uY0];
                    if (picketType === 'hss_rect' && picketW > 2 * pt) {
                        picket.models.innerUpper = new makerjs.models.Rectangle(picketW - 2 * pt, uH);
                        picket.models.innerUpper.origin = [px + pt, uY0];
                    }
                    // Lower Picket: from bottom runner to bottom of mid runner (only when not weld_top)
                    if (picketMidJoint !== 'weld_top' || midRailExtraPickets === 'yes') {
                        const lY0 = curPicketBotY;
                        const lY1 = curMidY_bot;
                        if (lY1 > lY0 + 0.1) {
                            const lH = lY1 - lY0;
                            picket.models.lower = new makerjs.models.Rectangle(picketW, lH);
                            picket.models.lower.origin = [px, lY0];
                            if (picketType === 'hss_rect' && picketW > 2 * pt) {
                                picket.models.innerLower = new makerjs.models.Rectangle(picketW - 2 * pt, lH);
                                picket.models.innerLower.origin = [px + pt, lY0];
                            }
                        }
                    }
                } else {
                    // Continuous picket from bottom runner to top runner
                    const pY0 = curPicketBotY;
                    const pY1 = curPicketTopY;
                    const pH = Math.max(1, pY1 - pY0);
                    picket.models.outer = new makerjs.models.Rectangle(picketW, pH);
                    picket.models.outer.origin = [px, pY0];
                    if (picketType === 'hss_rect' && picketW > 2 * pt) {
                        picket.models.inner = new makerjs.models.Rectangle(picketW - 2 * pt, pH);
                        picket.models.inner.origin = [px + pt, pY0];
                    }
                }
                return picket;
            };

            const createPuppyPicketModel = (puppyX_center, puppyLen) => {
                const puppyX = puppyX_center - picketW / 2;
                const puppy = { models: {} };
                const py0 = picketBottomY + puppyX_center * tan;
                const py1_raw = Math.min(py0 + puppyLen, picketTopY + puppyX_center * tan);
                const py1 = hasMid ? Math.min(py1_raw, midY_bot + puppyX_center * tan) : py1_raw;
                if (py1 > py0 + 0.1) {
                    const pyH = py1 - py0;
                    puppy.models.outer = new makerjs.models.Rectangle(picketW, pyH);
                    puppy.models.outer.origin = [puppyX, py0];
                    if (picketType === 'hss_rect' && picketW > 2 * pt) {
                        puppy.models.inner = new makerjs.models.Rectangle(picketW - 2 * pt, pyH);
                        puppy.models.inner.origin = [puppyX + pt, py0];
                    }
                    return puppy;
                }
                return null;
            };

            if (picketType !== 'none' && targetSpacing > 0) {
                if (resolvedMidCenters.length > 0) {
                    // MULTI-SPAN / MID-POST FENCES:
                    // Bay dividers: start centerline/edge, mid-post centerlines, end centerline/edge.
                    const startX = (actualLeftPostW > 0) ? (leftPostW / 2) : 0;
                    const endX = (actualRightPostW > 0) ? (length - rightPostW / 2) : length;
                    const bayDividers = [startX, ...resolvedMidCenters, endX];
                    const numBays = bayDividers.length - 1;

                    let pGlobalIdx = 0;
                    let ppGlobalIdx = 0;
                    const puppyLen = parseFloat(puppyPicketsLength) || 16.0;
                    if (puppyPickets === 'yes') {
                        model.models.puppyPickets = { models: {} };
                    }

                    for (let b = 0; b < numBays; b++) {
                        const s1 = bayDividers[b];
                        const s2 = bayDividers[b + 1];
                        const isLeftCorner = (b === 0);
                        const isRightCorner = (b === numBays - 1);
                        const bayPicketCenters = [];

                        const minCornerGapL = (isLeftCorner && actualLeftPostW > 0) ? (leftPostW / 2 + picketW / 2 + 0.5) : 0.75;
                        const minCornerGapR = (isRightCorner && actualRightPostW > 0) ? (rightPostW / 2 + picketW / 2 + 0.5) : 0.75;

                        if (isLeftCorner && !isRightCorner) {
                            // Bay 0: Right end s2 is a mid-post center.
                            // Distance from mid-post center to adjacent picket is EXACTLY targetSpacing
                            const pLast = s2 - targetSpacing;
                            const avail = pLast - s1;
                            const spaces = Math.max(0, Math.floor((avail - minCornerGapL + 1e-4) / targetSpacing));
                            const pFirst = pLast - spaces * targetSpacing;
                            for (let i = 0; i <= spaces; i++) {
                                bayPicketCenters.push(pFirst + i * targetSpacing);
                            }
                        } else if (isRightCorner && !isLeftCorner) {
                            // Bay N-1: Left end s1 is a mid-post center.
                            // Distance from mid-post center to adjacent picket is EXACTLY targetSpacing
                            const pFirst = s1 + targetSpacing;
                            const avail = s2 - pFirst;
                            const spaces = Math.max(0, Math.floor((avail - minCornerGapR + 1e-4) / targetSpacing));
                            for (let i = 0; i <= spaces; i++) {
                                bayPicketCenters.push(pFirst + i * targetSpacing);
                            }
                        } else if (!isLeftCorner && !isRightCorner) {
                            // Interior bay between two mid-posts:
                            const pFirst = s1 + targetSpacing;
                            const pLast = s2 - targetSpacing;
                            const avail = pLast - pFirst;
                            if (avail >= -1e-4) {
                                const spaces = Math.max(0, Math.round(avail / targetSpacing));
                                const actSpc = (spaces > 0) ? (avail / spaces) : targetSpacing;
                                for (let i = 0; i <= spaces; i++) {
                                    bayPicketCenters.push(pFirst + i * actSpc);
                                }
                            }
                        } else {
                            // Single-span (no mid-posts)
                            const avail = s2 - s1;
                            const minGap = 1.5;
                            const spaces = Math.max(0, Math.floor((avail - 2 * minGap + 1e-4) / targetSpacing));
                            const spanLen = spaces * targetSpacing;
                            const endGap = (avail - spanLen) / 2;
                            const pFirst = s1 + endGap;
                            for (let i = 0; i <= spaces; i++) {
                                bayPicketCenters.push(pFirst + i * targetSpacing);
                            }
                        }

                        bayPicketCenters.forEach(px_center => {
                            model.models.pickets.models['p' + pGlobalIdx] = createPicketModel(px_center);
                            pGlobalIdx++;
                        });

                        if (puppyPickets === 'yes' && bayPicketCenters.length > 1) {
                            for (let j = 0; j < bayPicketCenters.length - 1; j++) {
                                const ppX = (bayPicketCenters[j] + bayPicketCenters[j + 1]) / 2;
                                const ppModel = createPuppyPicketModel(ppX, puppyLen);
                                if (ppModel) {
                                    model.models.puppyPickets.models['pp' + ppGlobalIdx] = ppModel;
                                    ppGlobalIdx++;
                                }
                            }
                        }
                    }
                    numPickets = pGlobalIdx;
                } else if (clearSpan > 0) {
                    // SINGLE SPAN (no mid posts)
                    if (lengthRef === 'c_to_c') {
                        const fieldCenterDist = clearSpan + leftPostW / 2 + rightPostW / 2;
                        numPickets = Math.max(0, Math.ceil((fieldCenterDist - targetSpacing - 1e-4) / targetSpacing));
                        if (numPickets > 0) {
                            const endGap = (fieldCenterDist - (numPickets - 1) * targetSpacing) / 2;
                            faceMargin = endGap - leftPostW / 2;
                        }
                    } else if (lengthRef === 'c_to_out') {
                        const fieldCenterDist = clearSpan + leftPostW / 2 + (actualRightPostW > 0 ? rightPostW / 2 : 0);
                        numPickets = Math.max(0, Math.ceil((fieldCenterDist - targetSpacing - 1e-4) / targetSpacing));
                        if (numPickets > 0) {
                            const endGap = (fieldCenterDist - (numPickets - 1) * targetSpacing) / 2;
                            faceMargin = endGap - leftPostW / 2;
                        }
                    } else if (lengthRef === 'out_to_c') {
                        const fieldCenterDist = clearSpan + (actualLeftPostW > 0 ? leftPostW / 2 : 0) + rightPostW / 2;
                        numPickets = Math.max(0, Math.ceil((fieldCenterDist - targetSpacing - 1e-4) / targetSpacing));
                        if (numPickets > 0) {
                            const endGap = (fieldCenterDist - (numPickets - 1) * targetSpacing) / 2;
                            faceMargin = endGap - (actualLeftPostW > 0 ? leftPostW / 2 : 0);
                        }
                    } else { // out_to_out
                        const spanCenterDist = (actualRightPostW > 0 || actualLeftPostW > 0) ? ((length - actualRightPostW / 2) - (actualLeftPostW / 2)) : length;
                        numPickets = Math.max(0, Math.ceil((spanCenterDist - targetSpacing - 1e-4) / targetSpacing));
                        if (numPickets > 0) {
                            const endGap = (spanCenterDist - (numPickets - 1) * targetSpacing) / 2;
                            faceMargin = endGap - (actualLeftPostW > 0 ? (actualLeftPostW / 2) : 0);
                        }
                    }

                    if (numPickets > 0) {
                        for (let i = 0; i < numPickets; i++) {
                            const px_center = x0_span + faceMargin + i * targetSpacing;
                            model.models.pickets.models['p' + i] = createPicketModel(px_center);
                        }
                    }

                    // Puppy pickets (if enabled)
                    if (puppyPickets === 'yes' && numPickets > 1) {
                        model.models.puppyPickets = { models: {} };
                        const puppyLen = parseFloat(puppyPicketsLength) || 16.0;
                        const numPuppies = numPickets - 1;

                        for (let j = 0; j < numPuppies; j++) {
                            const p1_x = x0_span + faceMargin + j * targetSpacing;
                            const p2_x = p1_x + targetSpacing;
                            const puppyX_center = (p1_x + p2_x) / 2;
                            const ppModel = createPuppyPicketModel(puppyX_center, puppyLen);
                            if (ppModel) {
                                model.models.puppyPickets.models['pp' + j] = ppModel;
                            }
                        }
                    }
                }
            }
        }

        return model;
    },

    _fallback_rails_gates: function(length, fenceHeight, postHeight, leftPostW, rightPostW, midPostW, midPostCount, topRailH, midRailH, botRailH, picketW, picketSpacing, slope = 0, leftPostType = 'hss_rect', rightPostType = 'hss_rect', midPostType = 'hss_rect', topRailType = 'hss_rect', midRailType = 'none', botRailType = 'hss_rect', picketType = 'hss_rect', includeBasePlates = 'no', bpW = 6.0, bpH = 0.5, bpHoleD = 0.5, bpHoleOffsetX = 0.5, bpHoleOffsetY = 0.25, midRailGap = 6.0, railsGatesType = 'gates', kickPlate = 'none', kickPlateH = 12.0, kickPlateWeld = 'inner', kickPlateSize = 'PL11GA', meshType = 'none', meshOpening = 2.0, infillType = 'pickets', puppyPickets = 'no', puppyPicketsLength = 16.0, puppyPicketsSpacing = 2.0, botRailElevation = 0.0, topGap = 0.0, wantLeftPost = 'no', wantRightPost = 'no', midPostCenters = null, lengthRef = 'c_to_c', capPlateMode = 'no', capPlateThickness = 0.25, capPlateWidth = 2.0, capPlateLength = 2.0, midRailExtraPickets = "no") {
        const s = 4; 
        const L = length * s;
        const FH = fenceHeight * s;
        const PH = postHeight * s;
        const safeSlope = (typeof slope !== 'undefined' && !isNaN(parseFloat(slope))) ? parseFloat(slope) : 0;
        const rad = safeSlope * Math.PI / 180;
        const tan = Math.tan(rad);
        
        let postsHtml = "";
        let basePlatesHtml = "";
        let railsHtml = "";
        let picketsHtml = "";
        let kickPlateHtml = "";
        
        const isExtended = postHeight > fenceHeight;
        const midPH = isExtended ? (postHeight - fenceHeight) * s : 0;
        const effectiveEmbed_scaled = (includeBasePlates === 'yes') ? 0 : Math.max(0, postHeight - fenceHeight - 6.0) * s;
        
        const rise = L * tan;
        const maxRise = Math.max(0, rise);
        const groundY = PH - effectiveEmbed_scaled + maxRise + 50;

        const leftPostW_scaled = leftPostW * s;
        const rightPostW_scaled = rightPostW * s;
        const midPostW_scaled = midPostW * s;
        const topRailH_scaled = topRailH * s;
        const botRailH_scaled = botRailH * s;
        const midRailH_scaled = midRailH * s;
        const picketW_scaled = picketW * s;
        const picketSpacing_scaled = picketSpacing * s;
        const bpW_scaled = bpW * s;
        const bpH_scaled = bpH * s;

        const isGates = (railsGatesType === 'gates');

        if (isGates) {
            // Mitred full frame gate
            const pt = 0.12 * s;

            const makePoly = (pts, stroke, strokeWidth, dashed = false) => {
                const ptsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
                const dashAttr = dashed ? 'stroke-dasharray="2" opacity="0.6"' : '';
                return `<polygon points="${ptsStr}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr}/>`;
            };

            const frameTopY = groundY - FH;
            const frameBotY = groundY;

            // 1. Left Side Runner (polygon with sloped miter ends)
            const leftOuter = [
                [0, frameBotY],
                [leftPostW_scaled, frameBotY - botRailH_scaled],
                [leftPostW_scaled, frameTopY + topRailH_scaled],
                [0, frameTopY]
            ];
            const leftInner = [
                [pt, frameBotY - pt],
                [leftPostW_scaled - pt, frameBotY - botRailH_scaled + pt],
                [leftPostW_scaled - pt, frameTopY + topRailH_scaled - pt],
                [pt, frameTopY + pt]
            ];
            postsHtml += makePoly(leftOuter, "#00d4ff", 2);
            if (leftPostType === 'hss_rect' && leftPostW_scaled > 2 * pt) {
                postsHtml += makePoly(leftInner, "#00d4ff", 0.5, true);
            }

            // 2. Right Side Runner
            const rightOuter = [
                [L, frameBotY],
                [L - rightPostW_scaled, frameBotY - botRailH_scaled],
                [L - rightPostW_scaled, frameTopY + topRailH_scaled],
                [L, frameTopY]
            ];
            const rightInner = [
                [L - pt, frameBotY - pt],
                [L - rightPostW_scaled + pt, frameBotY - botRailH_scaled + pt],
                [L - rightPostW_scaled + pt, frameTopY + topRailH_scaled - pt],
                [L - pt, frameTopY + pt]
            ];
            postsHtml += makePoly(rightOuter, "#00d4ff", 2);
            if (rightPostType === 'hss_rect' && rightPostW_scaled > 2 * pt) {
                postsHtml += makePoly(rightInner, "#00d4ff", 0.5, true);
            }

            // 3. Top Runner
            const topOuter = [
                [0, frameTopY],
                [leftPostW_scaled, frameTopY + topRailH_scaled],
                [L - rightPostW_scaled, frameTopY + topRailH_scaled],
                [L, frameTopY]
            ];
            const topInner = [
                [pt, frameTopY + pt],
                [leftPostW_scaled - pt, frameTopY + topRailH_scaled - pt],
                [L - rightPostW_scaled + pt, frameTopY + topRailH_scaled - pt],
                [L - pt, frameTopY + pt]
            ];
            railsHtml += makePoly(topOuter, "#00d4ff", 2);
            if (topRailType === 'hss_rect' && topRailH_scaled > 2 * pt) {
                railsHtml += makePoly(topInner, "#00d4ff", 0.5, true);
            }

            // 4. Bottom Runner
            const botOuter = [
                [0, frameBotY],
                [leftPostW_scaled, frameBotY - botRailH_scaled],
                [L - rightPostW_scaled, frameBotY - botRailH_scaled],
                [L, frameBotY]
            ];
            const botInner = [
                [pt, frameBotY - pt],
                [leftPostW_scaled - pt, frameBotY - botRailH_scaled + pt],
                [L - rightPostW_scaled + pt, frameBotY - botRailH_scaled + pt],
                [L - pt, frameBotY - pt]
            ];
            railsHtml += makePoly(botOuter, "#00d4ff", 2);
            if (botRailType === 'hss_rect' && botRailH_scaled > 2 * pt) {
                railsHtml += makePoly(botInner, "#00d4ff", 0.5, true);
            }

            // 5. Mid Runner (butt joint)
            if (midRailType !== 'none') {
                const midY_scaled = frameBotY - botRailH_scaled - (midRailGap * s) - midRailH_scaled;
                const midLen_scaled = L - leftPostW_scaled - rightPostW_scaled;
                railsHtml += `<rect x="${leftPostW_scaled}" y="${midY_scaled}" width="${midLen_scaled}" height="${midRailH_scaled}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                if (midRailType === 'hss_rect' && midRailH_scaled > 2 * pt) {
                    railsHtml += `<rect class="hss-inner-line" x="${leftPostW_scaled}" y="${midY_scaled + pt}" width="${midLen_scaled}" height="${midRailH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2" opacity="0.6"/>`;
                }
            }

            // 6. Kick Plate (Sheet metal plate visual fill)
            let actualKpH = parseFloat(kickPlateH) || 10.0;
            let kpY_unscaled = 0;
            let kpW_unscaled = length;
            let kpX_unscaled = 0;

            if (kickPlate && kickPlate !== 'none') {
                const isOuter = (kickPlateWeld === 'outer');
                if (isOuter) {
                    kpX_unscaled = 0;
                    kpW_unscaled = length;
                    kpY_unscaled = 0;
                    actualKpH = (midRailType !== 'none') ? (botRailH + midRailGap + midRailH) : (parseFloat(kickPlateH) || 10.0);
                } else {
                    kpX_unscaled = leftPostW;
                    kpW_unscaled = Math.max(1, length - leftPostW - rightPostW);
                    kpY_unscaled = botRailH;
                    actualKpH = (midRailType !== 'none') ? midRailGap : (parseFloat(kickPlateH) || 10.0);
                }

                const kpX_scaled = kpX_unscaled * s;
                const kpW_scaled = kpW_unscaled * s;
                const kpH_scaled = actualKpH * s;
                const kpY_scaled = groundY - (kpY_unscaled + actualKpH) * s;
                
                kickPlateHtml += `
                    <g class="kickPlate">
                        <rect x="${kpX_scaled}" y="${kpY_scaled}" width="${kpW_scaled}" height="${kpH_scaled}" fill="rgba(0, 212, 255, 0.15)" stroke="#00ffff" stroke-width="1.5"/>
                        <line x1="${kpX_scaled}" y1="${kpY_scaled + kpH_scaled}" x2="${kpX_scaled + kpW_scaled}" y2="${kpY_scaled + kpH_scaled}" stroke="#00ff00" stroke-width="1" stroke-dasharray="2" opacity="0.8"/>
                    </g>
                `;
            }

            // 7. Vertical Pickets (clipped above kick plate or welded to top of mid runner)
            let rawPicketBotY, picketTopY_scaled;
            const hasMid = (midRailType !== 'none');
            const hasKP = (kickPlate && kickPlate !== 'none');
            if (hasMid) {
                if (midRailGap > (fenceHeight / 2)) {
                    rawPicketBotY = (hasKP ? (kpY_unscaled + actualKpH) : botRailH) * s;
                    picketTopY_scaled = frameBotY - (botRailH + midRailGap) * s;
                } else {
                    rawPicketBotY = (botRailH + midRailGap + midRailH) * s;
                    picketTopY_scaled = frameTopY + topRailH_scaled;
                }
            } else {
                rawPicketBotY = (hasKP ? (kpY_unscaled + actualKpH) : botRailH) * s;
                picketTopY_scaled = frameTopY + topRailH_scaled;
            }
            const picketBottomY_scaled = frameBotY - rawPicketBotY;
            const picketH_scaled = Math.max(8, picketBottomY_scaled - picketTopY_scaled);

            const spanCenterDist_scaled = (length_scaled - rightPostW_scaled / 2) - (leftPostW_scaled / 2);
            const targetSpacing_scaled = picketSpacing_scaled;
            const numPickets = (picketType !== 'none' && targetSpacing_scaled > 0) ? Math.max(0, Math.ceil((spanCenterDist_scaled - targetSpacing_scaled) / targetSpacing_scaled)) : 0;
            
            if (picketType !== 'none' && numPickets > 0) {
                const endGap_scaled = (spanCenterDist_scaled - (numPickets - 1) * targetSpacing_scaled) / 2;
                for (let i = 0; i < numPickets; i++) {
                    const px_center_scaled = (leftPostW_scaled / 2) + endGap_scaled + i * targetSpacing_scaled;
                    const px_scaled = px_center_scaled - picketW_scaled / 2;
                    picketsHtml += `<rect x="${px_scaled}" y="${picketTopY_scaled}" width="${picketW_scaled}" height="${picketH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                    if (picketType === 'hss_rect' && picketW_scaled > 1.6) {
                        const ptPick = 0.4;
                        picketsHtml += `<rect class="hss-inner-line" x="${px_scaled + ptPick}" y="${picketTopY_scaled}" width="${picketW_scaled - 2 * ptPick}" height="${picketH_scaled}" fill="none" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2" opacity="0.6"/>`;
                    }
                }
            }

            // 7B. Fallback Puppy Pickets (if active)
            const hasPuppyPickets = (puppyPickets && puppyPickets !== 'no');
            if (hasPuppyPickets && picketType !== 'none' && numPickets > 0) {
                const puppyLen = parseFloat(puppyPicketsLength) || 16.0;
                const puppyH_scaled = puppyLen * s;
                const puppyY_scaled = frameBotY - botRailH_scaled - puppyH_scaled;
                
                const endGap_scaled = (spanCenterDist_scaled - (numPickets - 1) * targetSpacing_scaled) / 2;
                const puppyCenters_scaled = [];
                const puppyPSpc_scaled = (parseFloat(puppyPicketsSpacing) || 2.0) * s;

                // Left end gap puppy picket (placed only if clear gap > puppy spacing, and centered)
                const px_0_scaled = (leftPostW_scaled / 2) + endGap_scaled;
                const clearLeftGap_scaled = (px_0_scaled - picketW_scaled / 2) - leftPostW_scaled;
                if (clearLeftGap_scaled > puppyPSpc_scaled * 0.9) {
                    puppyCenters_scaled.push((leftPostW_scaled + px_0_scaled - picketW_scaled / 2) / 2);
                }

                // Intermediate gaps
                for (let i = 0; i < numPickets - 1; i++) {
                    const x_i_scaled = (leftPostW_scaled / 2) + endGap_scaled + i * targetSpacing_scaled;
                    puppyCenters_scaled.push(x_i_scaled + targetSpacing_scaled / 2);
                }

                // Right end gap puppy picket (placed only if clear gap > puppy spacing, and centered)
                const x_last_scaled = (leftPostW_scaled / 2) + endGap_scaled + (numPickets - 1) * targetSpacing_scaled;
                const clearRightGap_scaled = (length_scaled - rightPostW_scaled) - (x_last_scaled + picketW_scaled / 2);
                if (clearRightGap_scaled > puppyPSpc_scaled * 0.9) {
                    puppyCenters_scaled.push(((length_scaled - rightPostW_scaled) + x_last_scaled + picketW_scaled / 2) / 2);
                }

                for (let j = 0; j < puppyCenters_scaled.length; j++) {
                    const px_center_scaled = puppyCenters_scaled[j];
                    const px_scaled = px_center_scaled - picketW_scaled / 2;
                    picketsHtml += `<rect x="${px_scaled}" y="${puppyY_scaled}" width="${picketW_scaled}" height="${puppyH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                    if (picketType === 'hss_rect' && picketW_scaled > 1.6) {
                        const ptPick = 0.4;
                        picketsHtml += `<rect class="hss-inner-line" x="${px_scaled + ptPick}" y="${puppyY_scaled}" width="${picketW_scaled - 2 * ptPick}" height="${puppyH_scaled}" fill="none" stroke="#00d4ff" stroke-width="0.5" stroke-dasharray="2" opacity="0.6"/>`;
                    }
                }
            }

        } else {
            // Original rails/posts SVG fallback logic
            const safeTopGap_scaled = Math.max(0, parseFloat(topGap) || 0) * s;
            const panelTopY_scaled = groundY - FH;
            const topY_scaled = panelTopY_scaled;
            const postTopY_scaled = panelTopY_scaled - safeTopGap_scaled;
            const leftPostY = postTopY_scaled;

            if (leftPostType !== 'none' && wantLeftPost !== 'no') {
                postsHtml += `<rect x="0" y="${leftPostY}" width="${leftPostW_scaled}" height="${PH}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                if (leftPostType === 'hss_rect' && leftPostW_scaled > 1.6) {
                    const pt = 0.8;
                    postsHtml += `<rect class="hss-inner-line" x="${pt}" y="${leftPostY + pt}" width="${leftPostW_scaled - 2 * pt}" height="${PH - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                }
                if (includeBasePlates === 'yes') {
                    basePlatesHtml += `<rect x="${leftPostW_scaled/2 - bpW_scaled/2}" y="${leftPostY + PH}" width="${bpW_scaled}" height="${bpH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                }
            }

            const rightPx = L - rightPostW_scaled;
            const rightPyBase = L * tan;
            const rightPostY = postTopY_scaled - rightPyBase;
            if (rightPostType !== 'none' && wantRightPost !== 'no') {
                postsHtml += `<rect x="${rightPx}" y="${rightPostY}" width="${rightPostW_scaled}" height="${PH}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                if (rightPostType === 'hss_rect' && rightPostW_scaled > 1.6) {
                    const pt = 0.8;
                    postsHtml += `<rect class="hss-inner-line" x="${rightPx + pt}" y="${rightPostY + pt}" width="${rightPostW_scaled - 2 * pt}" height="${PH - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                }
                if (includeBasePlates === 'yes') {
                    basePlatesHtml += `<rect x="${rightPx + rightPostW_scaled/2 - bpW_scaled/2}" y="${rightPostY + PH}" width="${bpW_scaled}" height="${bpH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                }
            }

            const actualLeftPostW_scaled = (wantLeftPost !== 'no' && leftPostType !== 'none') ? leftPostW_scaled : 0;
            const actualRightPostW_scaled = (wantRightPost !== 'no' && rightPostType !== 'none') ? rightPostW_scaled : 0;
            const clearSpan_scaled = L - actualLeftPostW_scaled - actualRightPostW_scaled;

            const resolvedMidCenters_scaled = (midPostCenters && Array.isArray(midPostCenters) && midPostCenters.length > 0)
                ? midPostCenters.map(cx => cx * s)
                : (midPostCount > 0 ? (() => {
                    const centers = [];
                    const centerDist = L - actualLeftPostW_scaled - actualRightPostW_scaled;
                    const spanSpacing = centerDist / (midPostCount + 1);
                    for (let i = 1; i <= midPostCount; i++) {
                        centers.push(actualLeftPostW_scaled + i * spanSpacing);
                    }
                    return centers;
                })() : []);

            const midPostTopY_scaled = topY_scaled + topRailH_scaled;
            const postBottomY_scaled = leftPostY + PH;
            const midPH_scaled = Math.max(1, postBottomY_scaled - midPostTopY_scaled);

            if (resolvedMidCenters_scaled.length > 0 && midPH_scaled > 0) {
                for (let i = 1; i <= resolvedMidCenters_scaled.length; i++) {
                    const midCx = resolvedMidCenters_scaled[i - 1];
                    const midPx = midCx - midPostW_scaled/2;
                    const midPyBase = midCx * tan;
                    const midPostY = midPostTopY_scaled - midPyBase;
                    postsHtml += `<rect x="${midPx}" y="${midPostY}" width="${midPostW_scaled}" height="${midPH_scaled}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    if (midPostType === 'hss_rect' && midPostW_scaled > 1.6 && midPH_scaled > 1.6) {
                        const pt = 0.8;
                        postsHtml += `<rect class="hss-inner-line" x="${midPx + pt}" y="${midPostY + pt}" width="${midPostW_scaled - 2 * pt}" height="${midPH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                    }
                    if (includeBasePlates === 'yes') {
                        basePlatesHtml += `<rect x="${midPx + midPostW_scaled/2 - bpW_scaled/2}" y="${midPostY + midPH_scaled}" width="${bpW_scaled}" height="${bpH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                    }
                }
            }

            // Top Runner: continuous across clear span sitting on top of mid posts
            if (topRailType !== 'none' && clearSpan_scaled > 0) {
                railsHtml += `<rect x="${actualLeftPostW_scaled}" y="${topY_scaled}" width="${clearSpan_scaled}" height="${topRailH_scaled}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                if (topRailType === 'hss_rect' && topRailH_scaled > 1.6) {
                    const pt = 0.8;
                    railsHtml += `<rect class="hss-inner-line" x="${actualLeftPostW_scaled}" y="${topY_scaled + pt}" width="${clearSpan_scaled}" height="${topRailH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                }
            }

            // Runner spans between posts for bottom and mid runners
            const runnerSpans_scaled = [];
            let curX_scaled = actualLeftPostW_scaled;
            if (resolvedMidCenters_scaled && resolvedMidCenters_scaled.length > 0) {
                resolvedMidCenters_scaled.forEach(midCx => {
                    const mpLeft = midCx - midPostW_scaled / 2;
                    const mpRight = midCx + midPostW_scaled / 2;
                    if (mpLeft > curX_scaled) {
                        runnerSpans_scaled.push({ startX: curX_scaled, endX: mpLeft });
                    }
                    curX_scaled = mpRight;
                });
            }
            if (L - actualRightPostW_scaled > curX_scaled) {
                runnerSpans_scaled.push({ startX: curX_scaled, endX: L - actualRightPostW_scaled });
            }

            const hasPosts_scaled = (actualLeftPostW_scaled > 0 || actualRightPostW_scaled > 0 || resolvedMidCenters_scaled.length > 0);
            const botElev_scaled = hasPosts_scaled ? ((typeof botRailElevation !== 'undefined' && !isNaN(parseFloat(botRailElevation))) ? parseFloat(botRailElevation) * s : 0) : 0;
            const botY_scaled = groundY - botElev_scaled - botRailH_scaled;
            if (botRailType !== 'none' && runnerSpans_scaled.length > 0) {
                runnerSpans_scaled.forEach(span => {
                    const w = span.endX - span.startX;
                    railsHtml += `<rect x="${span.startX}" y="${botY_scaled}" width="${w}" height="${botRailH_scaled}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    if (botRailType === 'hss_rect' && botRailH_scaled > 1.6) {
                        const pt = 0.8;
                        railsHtml += `<rect class="hss-inner-line" x="${span.startX}" y="${botY_scaled + pt}" width="${w}" height="${botRailH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                    }
                });
            }

            if (midRailType !== 'none' && runnerSpans_scaled.length > 0) {
                const midRailY_scaled = botY_scaled - (midRailGap * s) - midRailH_scaled;
                runnerSpans_scaled.forEach(span => {
                    const w = span.endX - span.startX;
                    railsHtml += `<rect x="${span.startX}" y="${midRailY_scaled}" width="${w}" height="${midRailH_scaled}" fill="none" stroke="#00d4ff" stroke-width="2"/>`;
                    if (midRailType === 'hss_rect' && midRailH_scaled > 1.6) {
                        const pt = 0.8;
                        railsHtml += `<rect class="hss-inner-line" x="${span.startX}" y="${midRailY_scaled + pt}" width="${w}" height="${midRailH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                    }
                });
            }

            const picketBottomY_scaled = botY_scaled + botRailH_scaled;
            const picketTopY_scaled = (midRailType !== 'none') ? (topY_scaled + midRailGap * s) : topY_scaled;
            const picketH_scaled = Math.max(8, picketTopY_scaled - picketBottomY_scaled);

            let numPickets = 0;
            let faceMargin_scaled = 0;
            const targetSpacing_scaled = picketSpacing_scaled;

            if (picketType !== 'none' && targetSpacing_scaled > 0) {
                if (resolvedMidCenters_scaled.length > 0) {
                    const startX_scaled = (actualLeftPostW_scaled > 0) ? (leftPostW_scaled / 2) : 0;
                    const endX_scaled = (actualRightPostW_scaled > 0) ? (L - rightPostW_scaled / 2) : L;
                    const bayDividers_scaled = [startX_scaled, ...resolvedMidCenters_scaled, endX_scaled];
                    const numBays = bayDividers_scaled.length - 1;

                    for (let b = 0; b < numBays; b++) {
                        const s1_s = bayDividers_scaled[b];
                        const s2_s = bayDividers_scaled[b + 1];
                        const isLeftCorner = (b === 0);
                        const isRightCorner = (b === numBays - 1);
                        const bayPicketCenters_scaled = [];

                        const minCornerGapL_s = (isLeftCorner && actualLeftPostW_scaled > 0) ? (leftPostW_scaled / 2 + picketW_scaled / 2 + 0.5 * s) : 0.75 * s;
                        const minCornerGapR_s = (isRightCorner && actualRightPostW_scaled > 0) ? (rightPostW_scaled / 2 + picketW_scaled / 2 + 0.5 * s) : 0.75 * s;

                        if (isLeftCorner && !isRightCorner) {
                            const pLast_s = s2_s - targetSpacing_scaled;
                            const avail_s = pLast_s - s1_s;
                            const spaces = Math.max(0, Math.floor((avail_s - minCornerGapL_s + 1e-4) / targetSpacing_scaled));
                            const pFirst_s = pLast_s - spaces * targetSpacing_scaled;
                            for (let i = 0; i <= spaces; i++) {
                                bayPicketCenters_scaled.push(pFirst_s + i * targetSpacing_scaled);
                            }
                        } else if (isRightCorner && !isLeftCorner) {
                            const pFirst_s = s1_s + targetSpacing_scaled;
                            const avail_s = s2_s - pFirst_s;
                            const spaces = Math.max(0, Math.floor((avail_s - minCornerGapR_s + 1e-4) / targetSpacing_scaled));
                            for (let i = 0; i <= spaces; i++) {
                                bayPicketCenters_scaled.push(pFirst_s + i * targetSpacing_scaled);
                            }
                        } else if (!isLeftCorner && !isRightCorner) {
                            const pFirst_s = s1_s + targetSpacing_scaled;
                            const pLast_s = s2_s - targetSpacing_scaled;
                            const avail_s = pLast_s - pFirst_s;
                            if (avail_s >= -1e-4) {
                                const spaces = Math.max(0, Math.round(avail_s / targetSpacing_scaled));
                                const actSpc_s = (spaces > 0) ? (avail_s / spaces) : targetSpacing_scaled;
                                for (let i = 0; i <= spaces; i++) {
                                    bayPicketCenters_scaled.push(pFirst_s + i * actSpc_s);
                                }
                            }
                        } else {
                            const avail_s = s2_s - s1_s;
                            const minGap_s = 1.5 * s;
                            const spaces = Math.max(0, Math.floor((avail_s - 2 * minGap_s + 1e-4) / targetSpacing_scaled));
                            const spanLen_s = spaces * targetSpacing_scaled;
                            const endGap_s = (avail_s - spanLen_s) / 2;
                            const pFirst_s = s1_s + endGap_s;
                            for (let i = 0; i <= spaces; i++) {
                                bayPicketCenters_scaled.push(pFirst_s + i * targetSpacing_scaled);
                            }
                        }

                        for (let i = 0; i < bayPicketCenters_scaled.length; i++) {
                            const px_center_scaled = bayPicketCenters_scaled[i];
                            const px_scaled = px_center_scaled - picketW_scaled / 2;
                            picketsHtml += `<rect x="${px_scaled}" y="${picketBottomY_scaled}" width="${picketW_scaled}" height="${picketH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                            if (picketType === 'hss_rect' && picketW_scaled > 1.6) {
                                const pt = 0.8;
                                picketsHtml += `<rect class="hss-inner-line" x="${px_scaled + pt}" y="${picketBottomY_scaled + pt}" width="${picketW_scaled - 2 * pt}" height="${picketH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                            }
                        }
                    }
                } else if (clearSpan_scaled > 0) {
                    if (lengthRef === 'c_to_c') {
                        const fieldCenterDist_scaled = clearSpan_scaled + leftPostW_scaled / 2 + rightPostW_scaled / 2;
                        numPickets = Math.max(0, Math.ceil((fieldCenterDist_scaled - targetSpacing_scaled - 1e-4) / targetSpacing_scaled));
                        if (numPickets > 0) {
                            const endGap_scaled = (fieldCenterDist_scaled - (numPickets - 1) * targetSpacing_scaled) / 2;
                            faceMargin_scaled = endGap_scaled - leftPostW_scaled / 2;
                        }
                    } else if (lengthRef === 'c_to_out') {
                        const fieldCenterDist_scaled = clearSpan_scaled + leftPostW_scaled / 2 + (actualRightPostW_scaled > 0 ? rightPostW_scaled / 2 : 0);
                        numPickets = Math.max(0, Math.ceil((fieldCenterDist_scaled - targetSpacing_scaled - 1e-4) / targetSpacing_scaled));
                        if (numPickets > 0) {
                            const endGap_scaled = (fieldCenterDist_scaled - (numPickets - 1) * targetSpacing_scaled) / 2;
                            faceMargin_scaled = endGap_scaled - leftPostW_scaled / 2;
                        }
                    } else if (lengthRef === 'out_to_c') {
                        const fieldCenterDist_scaled = clearSpan_scaled + (actualLeftPostW_scaled > 0 ? leftPostW_scaled / 2 : 0) + rightPostW_scaled / 2;
                        numPickets = Math.max(0, Math.ceil((fieldCenterDist_scaled - targetSpacing_scaled - 1e-4) / targetSpacing_scaled));
                        if (numPickets > 0) {
                            const endGap_scaled = (fieldCenterDist_scaled - (numPickets - 1) * targetSpacing_scaled) / 2;
                            faceMargin_scaled = endGap_scaled - (actualLeftPostW_scaled > 0 ? leftPostW_scaled / 2 : 0);
                        }
                    } else {
                        const spanCenterDist_scaled = (actualRightPostW_scaled > 0 || actualLeftPostW_scaled > 0) ? ((L - actualRightPostW_scaled / 2) - (actualLeftPostW_scaled / 2)) : L;
                        numPickets = Math.max(0, Math.ceil((spanCenterDist_scaled - targetSpacing_scaled - 1e-4) / targetSpacing_scaled));
                        if (numPickets > 0) {
                            const endGap_scaled = (spanCenterDist_scaled - (numPickets - 1) * targetSpacing_scaled) / 2;
                            faceMargin_scaled = endGap_scaled - (actualLeftPostW_scaled > 0 ? (actualLeftPostW_scaled / 2) : 0);
                        }
                    }

                    if (numPickets > 0) {
                        for (let i = 0; i < numPickets; i++) {
                            const px_center_scaled = actualLeftPostW_scaled + faceMargin_scaled + i * targetSpacing_scaled;
                            const px_scaled = px_center_scaled - picketW_scaled / 2;
                            picketsHtml += `<rect x="${px_scaled}" y="${picketBottomY_scaled}" width="${picketW_scaled}" height="${picketH_scaled}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;
                            if (picketType === 'hss_rect' && picketW_scaled > 1.6) {
                                const pt = 0.8;
                                picketsHtml += `<rect class="hss-inner-line" x="${px_scaled + pt}" y="${picketBottomY_scaled + pt}" width="${picketW_scaled - 2 * pt}" height="${picketH_scaled - 2 * pt}" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.6"/>`;
                            }
                        }
                    }
                }
            }
        }

        const totalW = L + 100;
        const totalH = groundY + 150;
        
        let html = `<svg viewBox="-50 -50 ${totalW} ${totalH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
        html += `<g transform="rotate(${slope})">`;
        html += basePlatesHtml;
        html += postsHtml;
        html += railsHtml;
        html += picketsHtml;
        html += `</g></svg>`;
        return html;
    },

    createRailCatalog: function(
        length,
        style,
        leftPostOpt,
        rightPostOpt,
        midPostsOpt,
        midPostCount,
        fenceHeight,
        postHeight,
        postType,
        postW,
        postH,
        postT,
        topRailType,
        topRailW,
        topRailH,
        topRailT,
        botRailType,
        botRailW,
        botRailH,
        botRailT,
        midRailType,
        midRailW,
        midRailH,
        midRailT,
        midRailGap,
        picketType,
        picketW,
        picketH,
        picketT,
        picketSpacing,
        includeBasePlates = 'no',
        bpW = 6.0,
        bpL = 6.0,
        bpH = 0.5,
        bpHoleD = 0.5,
        bpHoleOffsetX = 0.5,
        bpHoleOffsetY = 0.25,
        slope = 0
    ) {
        if (!this.isLibReady()) {
            return this._fallback_rail_catalog(
                length, style, leftPostOpt, rightPostOpt, midPostsOpt, midPostCount,
                fenceHeight, postHeight, postType, postW, postH, postT,
                topRailType, topRailW, topRailH, topRailT,
                botRailType, botRailW, botRailH, botRailT,
                midRailType, midRailW, midRailH, midRailT, midRailGap,
                picketType, picketW, picketH, picketT, picketSpacing,
                includeBasePlates, bpW, bpL, bpH, bpHoleD, bpHoleOffsetX, bpHoleOffsetY
            );
        }

        const model = {
            models: {
                posts: { models: {} },
                rails: { models: {} },
                pickets: { models: {} }
            }
        };

        if (includeBasePlates === 'yes') {
            model.models.basePlates = { models: {} };
        }

        const pt = 0.2; // default HSS inner offset if type is hss_rect
        const botRailY = postHeight - fenceHeight;
        const rad = (slope || 0) * Math.PI / 180;
        const tan = Math.tan(rad);

        // Helper to create polygon models
        const createPolygonModel = (points) => {
            const m = { paths: {} };
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                m.paths['edge' + i] = new makerjs.paths.Line(p1, p2);
            }
            return m;
        };

        // Determine post positions
        const posts = [];
        if (leftPostOpt === 'yes') {
            posts.push({ type: 'left', startX: 0, endX: postW, center: postW / 2 });
        }

        const isExecutive = (style === 'executive' || style === 'executive_custom');

        const midPosts = [];
        const hasMid = (midPostsOpt && midPostsOpt !== 'none' && midPostsOpt !== 'no');
        if (hasMid && midPostCount > 0) {
            const startXBound = (leftPostOpt === 'yes') ? postW : 0;
            const endXBound = (rightPostOpt === 'yes') ? (length - postW) : length;
            const centerDist = endXBound - startXBound;
            const spanSpacing = centerDist / (midPostCount + 1);

            for (let i = 1; i <= midPostCount; i++) {
                const midCx = startXBound + i * spanSpacing;
                const midPx = midCx - postW / 2;
                midPosts.push({ type: 'mid', startX: midPx, endX: midPx + postW, center: midCx });
                posts.push({ type: 'mid', startX: midPx, endX: midPx + postW, center: midCx });
            }
        }

        if (rightPostOpt === 'yes') {
            posts.push({ type: 'right', startX: length - postW, endX: length, center: length - postW / 2 });
        }

        // --- DRAW POSTS ---
        
        // 1. Left Post
        if (leftPostOpt === 'yes') {
            const leftPost = { models: {}, paths: {} };
            const outerPts = [
                [0, 0],
                [postW, 0],
                [postW, postHeight - topRailH + postW * tan],
                [0, postHeight]
            ];
            leftPost.models.outer = createPolygonModel(outerPts);

            if (postType === 'hss_rect' && postW > 2 * postT && postHeight > topRailH + 2 * postT) {
                const innerPts = [
                    [postT, postT],
                    [postW - postT, postT],
                    [postW - postT, postHeight - topRailH + postT + (postW - postT) * tan],
                    [postT, postHeight - postT + postT * tan]
                ];
                leftPost.models.inner = createPolygonModel(innerPts);
            }
            leftPost.origin = [0, 0];
            model.models.posts.models['leftPost'] = leftPost;

            if (includeBasePlates === 'yes') {
                const bp = {
                    models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                    paths: {
                        h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                        h2: new makerjs.paths.Circle([bpW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                    }
                };
                bp.origin = [postW / 2 - bpW / 2, -bpH];
                model.models.basePlates.models['bpLeft'] = bp;
            }
        }

        // 2. Right Post
        if (rightPostOpt === 'yes') {
            const rightPost = { models: {}, paths: {} };
            const rBaseY = (length - postW) * tan;
            const rTopY = length * tan;
            const outerPts = [
                [length - postW, rBaseY],
                [length, rTopY],
                [length, postHeight + rTopY],
                [length - postW, postHeight - topRailH + rBaseY]
            ];
            rightPost.models.outer = createPolygonModel(outerPts);

            if (postType === 'hss_rect' && postW > 2 * postT && postHeight > topRailH + 2 * postT) {
                const innerPts = [
                    [length - postW + postT, rBaseY + postT],
                    [length - postT, rTopY + postT],
                    [length - postT, postHeight - postT + rTopY],
                    [length - postW + postT, postHeight - topRailH + postT + rBaseY]
                ];
                rightPost.models.inner = createPolygonModel(innerPts);
            }
            rightPost.origin = [0, 0];
            model.models.posts.models['rightPost'] = rightPost;

            if (includeBasePlates === 'yes') {
                const bp = {
                    models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                    paths: {
                        h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                        h2: new makerjs.paths.Circle([bpW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                    }
                };
                bp.origin = [length - postW / 2 - bpW / 2, rBaseY - bpH];
                model.models.basePlates.models['bpRight'] = bp;
            }
        }

        // 3. Mid Posts
        midPosts.forEach((mp, idx) => {
            const midPost = { models: {}, paths: {} };
            const mpHeight = isExecutive ? postHeight : (postHeight - topRailH);
            const mBaseY = mp.startX * tan;
            const mTopY = (mp.startX + postW) * tan;

            const outerPts = [
                [mp.startX, mBaseY],
                [mp.startX + postW, mTopY],
                [mp.startX + postW, mpHeight + mTopY],
                [mp.startX, mpHeight + mBaseY]
            ];
            midPost.models.outer = createPolygonModel(outerPts);
            if (postType === 'hss_rect' && postW > 2 * postT && mpHeight > 2 * postT) {
                const innerPts = [
                    [mp.startX + postT, mBaseY + postT],
                    [mp.startX + postW - postT, mTopY + postT],
                    [mp.startX + postW - postT, mpHeight - postT + mTopY],
                    [mp.startX + postT, mpHeight - postT + mBaseY]
                ];
                midPost.models.inner = createPolygonModel(innerPts);
            }
            midPost.origin = [0, 0];
            model.models.posts.models['midPost_' + idx] = midPost;

            if (includeBasePlates === 'yes') {
                const bp = {
                    models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                    paths: {
                        h1: new makerjs.paths.Circle([bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2),
                        h2: new makerjs.paths.Circle([bpW - bpHoleOffsetX, bpHoleOffsetY], bpHoleD / 2)
                    }
                };
                bp.origin = [mp.center - bpW / 2, mBaseY - bpH];
                model.models.basePlates.models['bpMid_' + idx] = bp;
            }
        });

        // --- DRAW RAILS ---

        // Helper to draw split rail segment
        const drawSplitRailSegment = (xStart, xEnd, railH, railY, railType, railT, name) => {
            const segment = { models: {}, paths: {} };
            const w = xEnd - xStart;
            if (w <= 0.01) return;

            if (tan === 0) {
                segment.models.outer = new makerjs.models.Rectangle(w, railH);
                if (railType === 'hss_rect' && railH > 2 * railT) {
                    segment.models.inner = new makerjs.models.Rectangle(w, railH - 2 * railT);
                    segment.models.inner.origin = [0, railT];
                }
                segment.origin = [xStart, railY];
            } else {
                const p1_b = [xStart, railY + xStart * tan];
                const p2_b = [xEnd, railY + xEnd * tan];
                const p2_t = [xEnd, railY + railH + xEnd * tan];
                const p1_t = [xStart, railY + railH + xStart * tan];
                segment.models.outer = createPolygonModel([p1_b, p2_b, p2_t, p1_t]);

                if (railType === 'hss_rect' && railH > 2 * railT) {
                    const ip1_b = [xStart, railY + railT + xStart * tan];
                    const ip2_b = [xEnd, railY + railT + xEnd * tan];
                    const ip2_t = [xEnd, railY + railH - railT + xEnd * tan];
                    const ip1_t = [xStart, railY + railH - railT + xStart * tan];
                    segment.models.inner = createPolygonModel([ip1_b, ip2_b, ip2_t, ip1_t]);
                }
                segment.origin = [0, 0];
            }
            model.models.rails.models[name] = segment;
        };

        // Top Rail drawing
        if (topRailType !== 'none') {
            if (!isExecutive) {
                // Classical style: continuous top rail
                const topRail = { models: {}, paths: {} };
                const outerPts = [
                    [0, postHeight],
                    [leftPostOpt === 'yes' ? postW : 0, postHeight - topRailH + (leftPostOpt === 'yes' ? postW : 0) * tan],
                    [rightPostOpt === 'yes' ? (length - postW) : length, postHeight - topRailH + (rightPostOpt === 'yes' ? (length - postW) : length) * tan],
                    [length, postHeight + length * tan]
                ];
                topRail.models.outer = createPolygonModel(outerPts);

                if (topRailType === 'hss_rect' && topRailH > 2 * topRailT) {
                    const innerPts = [
                        [topRailT, postHeight - topRailT + topRailT * tan],
                        [leftPostOpt === 'yes' ? (postW - topRailT) : topRailT, postHeight - topRailH + topRailT + (leftPostOpt === 'yes' ? (postW - topRailT) : topRailT) * tan],
                        [rightPostOpt === 'yes' ? (length - postW + topRailT) : (length - topRailT), postHeight - topRailH + topRailT + (rightPostOpt === 'yes' ? (length - postW + topRailT) : (length - topRailT)) * tan],
                        [length - topRailT, postHeight - topRailT + (length - topRailT) * tan]
                    ];
                    topRail.models.inner = createPolygonModel(innerPts);
                }
                
                // Add miter lines for visual clarity
                if (leftPostOpt === 'yes') {
                    topRail.paths.miterL = new makerjs.paths.Line([0, postHeight], [postW, postHeight - topRailH + postW * tan]);
                }
                if (rightPostOpt === 'yes') {
                    topRail.paths.miterR = new makerjs.paths.Line([length, postHeight + length * tan], [length - postW, postHeight - topRailH + (length - postW) * tan]);
                }

                topRail.origin = [0, 0];
                model.models.rails.models['topRail'] = topRail;
            } else {
                // Executive style: top rail split by mid posts
                const spanRanges = [];
                let currentL = (leftPostOpt === 'yes') ? postW : 0;

                midPosts.forEach(mp => {
                    spanRanges.push({ start: currentL, end: mp.startX });
                    currentL = mp.endX;
                });
                spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (length - postW) : length });

                spanRanges.forEach((range, idx) => {
                    drawSplitRailSegment(range.start, range.end, topRailH, postHeight - topRailH, topRailType, topRailT, 'topRail_' + idx);
                });
            }
        }

        // Bottom Rail (always split by posts)
        if (botRailType !== 'none') {
            const spanRanges = [];
            let currentL = (leftPostOpt === 'yes') ? postW : 0;

            midPosts.forEach(mp => {
                spanRanges.push({ start: currentL, end: mp.startX });
                currentL = mp.endX;
            });
            spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (length - postW) : length });

            spanRanges.forEach((range, idx) => {
                drawSplitRailSegment(range.start, range.end, botRailH, botRailY, botRailType, botRailT, 'botRail_' + idx);
            });
        }

        // Mid Rail (split by posts, if active)
        if (midRailType !== 'none') {
            const spanRanges = [];
            let currentL = (leftPostOpt === 'yes') ? postW : 0;

            midPosts.forEach(mp => {
                spanRanges.push({ start: currentL, end: mp.startX });
                currentL = mp.endX;
            });
            spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (length - postW) : length });

            const midRailY = postHeight - topRailH - midRailGap - midRailH;

            spanRanges.forEach((range, idx) => {
                drawSplitRailSegment(range.start, range.end, midRailH, midRailY, midRailType, midRailT, 'midRail_' + idx);
            });
        }

        // --- DRAW PICKETS ---
        if (picketType !== 'none' && picketSpacing > 0) {
            const spanRanges = [];
            let currentL = (leftPostOpt === 'yes') ? postW : 0;

            midPosts.forEach(mp => {
                spanRanges.push({ start: currentL, end: mp.startX });
                currentL = mp.endX;
            });
            spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (length - postW) : length });

            let picketIndex = 0;
            spanRanges.forEach(range => {
                let leftPostCenter = range.start;
                if (range.start > 0) {
                    leftPostCenter = range.start - postW / 2;
                } else if (leftPostOpt === 'yes') {
                    leftPostCenter = postW / 2;
                }

                let rightPostCenter = range.end;
                if (range.end < length) {
                    rightPostCenter = range.end + postW / 2;
                } else if (rightPostOpt === 'yes') {
                    rightPostCenter = length - postW / 2;
                }

                const spanCenterDist = rightPostCenter - leftPostCenter;
                const targetSpacing = picketSpacing;
                const numPickets = Math.max(0, Math.ceil((spanCenterDist - targetSpacing) / targetSpacing));
                const endGap = (spanCenterDist - (numPickets - 1) * targetSpacing) / 2;

                if (numPickets > 0) {
                    const baseStart = botRailY + botRailH;
                    const baseEnd = (midRailType !== 'none') ? (postHeight - topRailH - midRailGap - midRailH) : (postHeight - topRailH);

                    for (let i = 0; i < numPickets; i++) {
                        const px_center = leftPostCenter + endGap + i * targetSpacing;
                        const px1 = px_center - picketW / 2;
                        const px2 = px_center + picketW / 2;
                        const picket = { models: {} };

                        if (tan === 0) {
                            const yStart = baseStart;
                            const yEnd = baseEnd;
                            const picketHeight = yEnd - yStart;
                            picket.models.outer = new makerjs.models.Rectangle(picketW, picketHeight);
                            if (picketType === 'hss_rect' && picketW > 2 * picketT && picketHeight > 2 * picketT) {
                                picket.models.inner = new makerjs.models.Rectangle(picketW - 2 * picketT, picketHeight - 2 * picketT);
                                picket.models.inner.origin = [picketT, picketT];
                            }
                            picket.origin = [px1, yStart];
                        } else {
                            const yStart1 = baseStart + px1 * tan;
                            const yStart2 = baseStart + px2 * tan;
                            const yEnd1 = baseEnd + px1 * tan;
                            const yEnd2 = baseEnd + px2 * tan;

                            picket.models.outer = createPolygonModel([
                                [px1, yStart1],
                                [px2, yStart2],
                                [px2, yEnd2],
                                [px1, yEnd1]
                            ]);

                            if (picketType === 'hss_rect' && picketW > 2 * picketT) {
                                const ipx1 = px1 + picketT;
                                const ipx2 = px2 - picketT;
                                const iyStart1 = yStart1 + picketT;
                                const iyStart2 = yStart2 + picketT;
                                const iyEnd1 = yEnd1 - picketT;
                                const iyEnd2 = yEnd2 - picketT;

                                picket.models.inner = createPolygonModel([
                                    [ipx1, iyStart1],
                                    [ipx2, iyStart2],
                                    [ipx2, iyEnd2],
                                    [ipx1, iyEnd1]
                                ]);
                            }
                            picket.origin = [0, 0];
                        }
                        model.models.pickets.models['p_' + (picketIndex++)] = picket;
                    }
                }
            });
        }

        return model;
    },

    _fallback_rail_catalog: function(
        length,
        style,
        leftPostOpt,
        rightPostOpt,
        midPostsOpt,
        midPostCount,
        fenceHeight,
        postHeight,
        postType,
        postW,
        postH,
        postT,
        topRailType,
        topRailW,
        topRailH,
        topRailT,
        botRailType,
        botRailW,
        botRailH,
        botRailT,
        midRailType,
        midRailW,
        midRailH,
        midRailT,
        midRailGap,
        picketType,
        picketW,
        picketH,
        picketT,
        picketSpacing,
        includeBasePlates = 'no',
        bpW = 6.0,
        bpL = 6.0,
        bpH = 0.5,
        bpHoleD = 0.5,
        bpHoleOffsetX = 0.5,
        bpHoleOffsetY = 0.25
    ) {
        const s = 4; // Scale factor for fallback drawing
        const L = length * s;
        const PH = postHeight * s;
        const FH = fenceHeight * s;
        const botRailY_scaled = PH - FH;
        const postW_scaled = postW * s;
        const topRailH_scaled = topRailH * s;
        const botRailH_scaled = botRailH * s;
        const midRailH_scaled = midRailH * s;
        const midRailGap_scaled = midRailGap * s;
        const picketW_scaled = picketW * s;
        const picketSpacing_scaled = picketSpacing * s;
        
        let postsHtml = "";
        let basePlatesHtml = "";
        let railsHtml = "";
        let picketsHtml = "";
        
        // Define SVG height
        const groundY = PH + 50; 
        const strokeColor = "#00d4ff";

        // Helpers
        const makePoly = (pts, color, width, isDash = false) => {
            const pointsStr = pts.map(p => `${p[0]},${groundY - p[1]}`).join(" ");
            return `<polygon points="${pointsStr}" fill="none" stroke="${color}" stroke-width="${width}" ${isDash ? 'stroke-dasharray="2" opacity="0.6"' : ''}/>`;
        };

        const makeRect = (x, y, w, h, color, width, isDash = false, extraClass = '') => {
            const classAttr = extraClass ? ` class="${extraClass}"` : (isDash ? ' class="hss-inner-line"' : '');
            return `<rect${classAttr} x="${x}" y="${groundY - y - h}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${width}" ${isDash ? 'stroke-dasharray="2" opacity="0.6"' : ''}/>`;
        };

        const makeLine = (x1, y1, x2, y2, color, width, isDash = false) => {
            return `<line x1="${x1}" y1="${groundY - y1}" x2="${x2}" y2="${groundY - y2}" stroke="${color}" stroke-width="${width}" ${isDash ? 'stroke-dasharray="2" opacity="0.6"' : ''}/>`;
        };

        const makeCircle = (cx, cy, r, color, width) => {
            return `<circle cx="${cx}" cy="${groundY - cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
        };

        const isExecutive = (style === 'executive' || style === 'executive_custom');

        const midPosts = [];
        const hasMid = (midPostsOpt && midPostsOpt !== 'none' && midPostsOpt !== 'no');
        if (hasMid && midPostCount > 0) {
            const startXBound = (leftPostOpt === 'yes') ? postW_scaled : 0;
            const endXBound = (rightPostOpt === 'yes') ? (L - postW_scaled) : L;
            const centerDist = endXBound - startXBound;
            const spanSpacing = centerDist / (midPostCount + 1);

            for (let i = 1; i <= midPostCount; i++) {
                const midCx = startXBound + i * spanSpacing;
                midPosts.push({ startX: midCx - postW_scaled / 2, endX: midCx + postW_scaled / 2, center: midCx });
            }
        }

        // --- DRAW POSTS ---
        if (leftPostOpt === 'yes') {
            const outer = [[0, 0], [postW_scaled, 0], [postW_scaled, PH - topRailH_scaled], [0, PH]];
            postsHtml += makePoly(outer, strokeColor, 2);
            if (postType === 'hss_rect' && postW > 2 * postT) {
                const pt = postT * s;
                const inner = [[pt, pt], [postW_scaled - pt, pt], [postW_scaled - pt, PH - topRailH_scaled + pt], [pt, PH - pt]];
                postsHtml += makePoly(inner, strokeColor, 0.5, true);
            }

            if (includeBasePlates === 'yes') {
                const bpW_scaled = bpW * s;
                const bpH_scaled = bpH * s;
                const bx = postW_scaled / 2 - bpW_scaled / 2;
                basePlatesHtml += makeRect(bx, -bpH_scaled, bpW_scaled, bpH_scaled, strokeColor, 2);
                basePlatesHtml += makeCircle(bx + bpHoleOffsetX * s, -bpH_scaled / 2, (bpHoleD / 2) * s, strokeColor, 1);
                basePlatesHtml += makeCircle(bx + bpW_scaled - bpHoleOffsetX * s, -bpH_scaled / 2, (bpHoleD / 2) * s, strokeColor, 1);
            }
        }

        if (rightPostOpt === 'yes') {
            const outer = [[L - postW_scaled, 0], [L, 0], [L, PH], [L - postW_scaled, PH - topRailH_scaled]];
            postsHtml += makePoly(outer, strokeColor, 2);
            if (postType === 'hss_rect' && postW > 2 * postT) {
                const pt = postT * s;
                const inner = [[L - postW_scaled + pt, pt], [L - pt, pt], [L - pt, PH - pt], [L - postW_scaled + pt, PH - topRailH_scaled + pt]];
                postsHtml += makePoly(inner, strokeColor, 0.5, true);
            }

            if (includeBasePlates === 'yes') {
                const bpW_scaled = bpW * s;
                const bpH_scaled = bpH * s;
                const bx = L - postW_scaled / 2 - bpW_scaled / 2;
                basePlatesHtml += makeRect(bx, -bpH_scaled, bpW_scaled, bpH_scaled, strokeColor, 2);
                basePlatesHtml += makeCircle(bx + bpHoleOffsetX * s, -bpH_scaled / 2, (bpHoleD / 2) * s, strokeColor, 1);
                basePlatesHtml += makeCircle(bx + bpW_scaled - bpHoleOffsetX * s, -bpH_scaled / 2, (bpHoleD / 2) * s, strokeColor, 1);
            }
        }

        midPosts.forEach(mp => {
            const mpH = isExecutive ? PH : (PH - topRailH_scaled);
            postsHtml += makeRect(mp.startX, 0, postW_scaled, mpH, strokeColor, 2);
            if (postType === 'hss_rect' && postW > 2 * postT) {
                const pt = postT * s;
                postsHtml += makeRect(mp.startX + pt, pt, postW_scaled - 2 * pt, mpH - 2 * pt, strokeColor, 0.5, true);
            }

            if (includeBasePlates === 'yes') {
                const bpW_scaled = bpW * s;
                const bpH_scaled = bpH * s;
                const bx = mp.center - bpW_scaled / 2;
                basePlatesHtml += makeRect(bx, -bpH_scaled, bpW_scaled, bpH_scaled, strokeColor, 2);
                basePlatesHtml += makeCircle(bx + bpHoleOffsetX * s, -bpH_scaled / 2, (bpHoleD / 2) * s, strokeColor, 1);
                basePlatesHtml += makeCircle(bx + bpW_scaled - bpHoleOffsetX * s, -bpH_scaled / 2, (bpHoleD / 2) * s, strokeColor, 1);
            }
        });

        // --- DRAW RAILS ---

        // Top Rail
        if (topRailType !== 'none') {
            if (!isExecutive) {
                // Classical style continuous
                const outer = [
                    [0, PH],
                    [leftPostOpt === 'yes' ? postW_scaled : 0, PH - topRailH_scaled],
                    [rightPostOpt === 'yes' ? (L - postW_scaled) : L, PH - topRailH_scaled],
                    [L, PH]
                ];
                railsHtml += makePoly(outer, strokeColor, 2);

                if (topRailType === 'hss_rect' && topRailH > 2 * topRailT) {
                    const pt = topRailT * s;
                    const inner = [
                        [pt, PH - pt],
                        [leftPostOpt === 'yes' ? (postW_scaled - pt) : pt, PH - topRailH_scaled + pt],
                        [rightPostOpt === 'yes' ? (L - postW_scaled + pt) : (L - pt), PH - topRailH_scaled + pt],
                        [L - pt, PH - pt]
                    ];
                    railsHtml += makePoly(inner, strokeColor, 0.5, true);
                }

                // Miters
                if (leftPostOpt === 'yes') {
                    railsHtml += makeLine(0, PH, postW_scaled, PH - topRailH_scaled, strokeColor, 1);
                }
                if (rightPostOpt === 'yes') {
                    railsHtml += makeLine(L, PH, L - postW_scaled, PH - topRailH_scaled, strokeColor, 1);
                }
            } else {
                // Executive style top rail segments
                const spanRanges = [];
                let currentL = (leftPostOpt === 'yes') ? postW_scaled : 0;

                midPosts.forEach(mp => {
                    spanRanges.push({ start: currentL, end: mp.startX });
                    currentL = mp.endX;
                });
                spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (L - postW_scaled) : L });

                spanRanges.forEach((range, idx) => {
                    const outer = [];
                    if (idx === 0 && leftPostOpt === 'yes') {
                        outer.push([0, PH]);
                        outer.push([postW_scaled, PH - topRailH_scaled]);
                    } else {
                        outer.push([range.start, PH]);
                        outer.push([range.start, PH - topRailH_scaled]);
                    }

                    if (idx === spanRanges.length - 1 && rightPostOpt === 'yes') {
                        outer.push([L - postW_scaled, PH - topRailH_scaled]);
                        outer.push([L, PH]);
                    } else {
                        outer.push([range.end, PH - topRailH_scaled]);
                        outer.push([range.end, PH]);
                    }

                    railsHtml += makePoly(outer, strokeColor, 2);

                    if (topRailType === 'hss_rect' && topRailH > 2 * topRailT) {
                        const pt = topRailT * s;
                        const inner = [];
                        if (idx === 0 && leftPostOpt === 'yes') {
                            inner.push([pt, PH - pt]);
                            inner.push([postW_scaled - pt, PH - topRailH_scaled + pt]);
                        } else {
                            inner.push([range.start + pt, PH - pt]);
                            inner.push([range.start + pt, PH - topRailH_scaled + pt]);
                        }

                        if (idx === spanRanges.length - 1 && rightPostOpt === 'yes') {
                            inner.push([L - postW_scaled + pt, PH - topRailH_scaled + pt]);
                            inner.push([L - pt, PH - pt]);
                        } else {
                            inner.push([range.end - pt, PH - topRailH_scaled + pt]);
                            inner.push([range.end - pt, PH - pt]);
                        }
                        railsHtml += makePoly(inner, strokeColor, 0.5, true);
                    }

                    // Miters
                    if (idx === 0 && leftPostOpt === 'yes') {
                        railsHtml += makeLine(0, PH, postW_scaled, PH - topRailH_scaled, strokeColor, 1);
                    }
                    if (idx === spanRanges.length - 1 && rightPostOpt === 'yes') {
                        railsHtml += makeLine(L, PH, L - postW_scaled, PH - topRailH_scaled, strokeColor, 1);
                    }
                });
            }
        }

        // Bottom Rail segments
        if (botRailType !== 'none') {
            const spanRanges = [];
            let currentL = (leftPostOpt === 'yes') ? postW_scaled : 0;

            midPosts.forEach(mp => {
                spanRanges.push({ start: currentL, end: mp.startX });
                currentL = mp.endX;
            });
            spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (L - postW_scaled) : L });

            spanRanges.forEach(range => {
                const w = range.end - range.start;
                if (w > 0.1) {
                    railsHtml += makeRect(range.start, botRailY_scaled, w, botRailH_scaled, strokeColor, 2);
                    if (botRailType === 'hss_rect' && botRailH > 2 * botRailT) {
                        const pt = botRailT * s;
                        railsHtml += makeRect(range.start, botRailY_scaled + pt, w, botRailH_scaled - 2 * pt, strokeColor, 0.5, true);
                    }
                }
            });
        }

        // Mid Rail segments
        if (midRailType !== 'none') {
            const spanRanges = [];
            let currentL = (leftPostOpt === 'yes') ? postW_scaled : 0;

            midPosts.forEach(mp => {
                spanRanges.push({ start: currentL, end: mp.startX });
                currentL = mp.endX;
            });
            spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (L - postW_scaled) : L });

            const midRailY_scaled = PH - topRailH_scaled - midRailGap_scaled - midRailH_scaled;

            spanRanges.forEach(range => {
                const w = range.end - range.start;
                if (w > 0.1) {
                    railsHtml += makeRect(range.start, midRailY_scaled, w, midRailH_scaled, strokeColor, 2);
                    if (midRailType === 'hss_rect' && midRailH > 2 * midRailT) {
                        const pt = midRailT * s;
                        railsHtml += makeRect(range.start, midRailY_scaled + pt, w, midRailH_scaled - 2 * pt, strokeColor, 0.5, true);
                    }
                }
            });
        }

        // --- DRAW PICKETS ---
        if (picketType !== 'none' && picketSpacing > 0) {
            const spanRanges = [];
            let currentL = (leftPostOpt === 'yes') ? postW_scaled : 0;

            midPosts.forEach(mp => {
                spanRanges.push({ start: currentL, end: mp.startX });
                currentL = mp.endX;
            });
            spanRanges.push({ start: currentL, end: (rightPostOpt === 'yes') ? (L - postW_scaled) : L });

            spanRanges.forEach(range => {
                let leftPostCenter = range.start;
                if (range.start > 0) {
                    leftPostCenter = range.start - postW_scaled / 2;
                } else if (leftPostOpt === 'yes') {
                    leftPostCenter = postW_scaled / 2;
                }

                let rightPostCenter = range.end;
                if (range.end < L) {
                    rightPostCenter = range.end + postW_scaled / 2;
                } else if (rightPostOpt === 'yes') {
                    rightPostCenter = L - postW_scaled / 2;
                }

                const spanCenterDist = rightPostCenter - leftPostCenter;
                const targetSpacing = picketSpacing_scaled;
                const numPickets = Math.max(0, Math.ceil((spanCenterDist - targetSpacing) / targetSpacing));
                const endGap = (spanCenterDist - (numPickets - 1) * targetSpacing) / 2;

                if (numPickets > 0) {
                    const yStart = botRailY_scaled + botRailH_scaled;
                    const yEnd = (midRailType !== 'none') ? (PH - topRailH_scaled - midRailGap_scaled - midRailH_scaled) : (PH - topRailH_scaled);
                    const picketH_scaled = yEnd - yStart;

                    for (let i = 0; i < numPickets; i++) {
                        const px_center = leftPostCenter + endGap + i * targetSpacing;
                        const px = px_center - picketW_scaled / 2;
                        picketsHtml += makeRect(px, yStart, picketW_scaled, picketH_scaled, strokeColor, 0.8, false, 'picket-line');
                        if (picketType === 'hss_rect' && picketW > 2 * picketT) {
                            const pt = picketT * s;
                            picketsHtml += makeRect(px + pt, yStart + pt, picketW_scaled - 2 * pt, picketH_scaled - 2 * pt, strokeColor, 0.4, true, 'hss-inner-line picket-line');
                        }
                    }
                }
            });
        }

        const totalW = L + 100;
        const totalH = groundY + 150;
        
        let html = `<svg viewBox="-50 -50 ${totalW} ${totalH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
        html += `<g>`;
        html += basePlatesHtml;
        html += postsHtml;
        html += railsHtml;
        html += `<g class="pickets-group">${picketsHtml}</g>`;
        html += `</g></svg>`;
        return html;
    },

    createLoosePostModel: function(postW, postHeight, topRailH, postType, postT, includeBasePlates, bpW, bpL, bpH, bpHoleD, bpHoleOffsetX, bpHoleOffsetY, style, fenceHeight, botRailH, midRailType, midRailGap, midRailH, side = 'left', extraLen = 0, offsetX = 0, offsetY = 0, basePlateConfig = null, includeCap = 'no', capThickness = 0.25, capWidth = 2.0, capLength = 2.0) {
        const model = {
            models: {
                posts: { models: {} }
            }
        };
        if (includeBasePlates === 'yes') {
            model.models.basePlates = { models: {} };
        }
        
        const addLen = parseFloat(extraLen) || 0;
        const offX = parseFloat(offsetX) || 0;
        const offY = parseFloat(offsetY) || 0;

        const effectivePostHeight = postHeight + addLen;
        
        const singlePost = { models: {}, paths: {} };
        singlePost.models.outer = new makerjs.models.Rectangle(postW, effectivePostHeight);
        singlePost.origin = [offX - postW / 2, 0];
        model.models.posts.models['loosePost'] = singlePost;

        const isMeshStyle = (style === 'urban_balcony' || style === 'villa_balcony' || style === 'urban_custom' || style === 'villa_custom');
        if (isMeshStyle) {
            const fH = fenceHeight !== undefined ? fenceHeight : 41.0;
            const bY = postHeight - fH;
            const bH = botRailH !== undefined ? botRailH : 1.5;
            const tH = topRailH !== undefined ? topRailH : 1.5;
            const mGap = midRailGap !== undefined ? midRailGap : 3.0;
            const mH = midRailH !== undefined ? midRailH : 1.5;

            const yStart = bY + bH;
            const hasMid = (style === 'villa_balcony' || (style === 'villa_custom' && midRailType !== 'none'));
            const yEnd = hasMid ? (postHeight - tH - mGap - mH) : (postHeight - tH);
            const fbHeight = yEnd - yStart;
            const fbW = 1.0; // flat bar width
            const actualFbHeight = fbHeight - 2.0;

            if (actualFbHeight > 0) {
                const fb = {
                    models: {
                        outer: new makerjs.models.Rectangle(fbW, actualFbHeight)
                    }
                };
                const fbX = (side === 'right' || side === 'looseRightPost') ? (offX - postW / 2 - fbW) : (offX + postW / 2);
                fb.origin = [fbX, yStart + 1.0];
                model.models.posts.models['flatBarAttachment'] = fb;
            }
        }

        if (includeBasePlates === 'yes') {
            const bpc = basePlateConfig || {};
            const isWallMount = (bpc.connectionType === 'wall_mount');
            if (isWallMount) {
                const wallMountOffset = (bpc.wallMountOffset !== undefined && !isNaN(parseFloat(bpc.wallMountOffset))) ? parseFloat(bpc.wallMountOffset) : 1.0;
                const plateW = (bpc.plateShape === 'qiw_standard') ? (bpc.qiwPlateType === 'QBP54' ? 5.0 : 4.0) : (parseFloat(bpc.width) || 6.0);
                const plateH = (bpc.plateShape === 'qiw_standard') ? (bpc.qiwPlateType === 'QBP54' ? 5.0 : 4.0) : (parseFloat(bpc.height) || 6.0);
                const holeMargin = (bpc.plateShape === 'qiw_standard') ? 0.75 : (parseFloat(bpc.corners ? bpc.corners.margin : 1.0) || 1.0);
                const holeD = parseFloat(bpc.corners ? bpc.corners.diameter : 0.5) || 0.5;

                const bp = {
                    models: { outer: new makerjs.models.Rectangle(plateW, plateH) },
                    paths: {}
                };
                const holes = [
                    { x: holeMargin, y: holeMargin },
                    { x: plateW - holeMargin, y: holeMargin },
                    { x: holeMargin, y: plateH - holeMargin },
                    { x: plateW - holeMargin, y: plateH - holeMargin }
                ];
                holes.forEach((h, hIdx) => {
                    const circle = new makerjs.paths.Circle([h.x, h.y], holeD / 2);
                    circle.layer = 'bpHole';
                    bp.paths['hole_' + hIdx] = circle;
                });
                const postCx = offX + postW / 2;
                bp.origin = [postCx - plateW / 2, wallMountOffset];
                model.models.basePlates.models['bpLoose'] = bp;
            } else {
                const leftX1 = bpHoleOffsetX - bpHoleD / 2;
                const leftX2 = bpHoleOffsetX + bpHoleD / 2;
                const rightX1 = bpW - bpHoleOffsetX - bpHoleD / 2;
                const rightX2 = bpW - bpHoleOffsetX + bpHoleD / 2;
                const bp = {
                    models: { outer: new makerjs.models.Rectangle(bpW, bpH) },
                    paths: {
                        h1_left: new makerjs.paths.Line([leftX1, 0], [leftX1, bpH]),
                        h1_right: new makerjs.paths.Line([leftX2, 0], [leftX2, bpH]),
                        h2_left: new makerjs.paths.Line([rightX1, 0], [rightX1, bpH]),
                        h2_right: new makerjs.paths.Line([rightX2, 0], [rightX2, bpH])
                    }
                };
                bp.paths.h1_left.layer = 'bpHole';
                bp.paths.h1_right.layer = 'bpHole';
                bp.paths.h2_left.layer = 'bpHole';
                bp.paths.h2_right.layer = 'bpHole';
                bp.origin = [-bpW / 2, -bpH];
                model.models.basePlates.models['bpLoose'] = bp;
            }
        }

        if (includeCap === 'yes' || includeCap === true) {
            const capT = parseFloat(capThickness) || 0.25;
            const capWidthVal = parseFloat(capWidth) || postW;
            const cap = {
                models: { outer: new makerjs.models.Rectangle(capWidthVal, capT) },
                origin: [offX - capWidthVal / 2, effectivePostHeight]
            };
            if (!model.models.capPlates) model.models.capPlates = { models: {} };
            model.models.capPlates.models['capLoose'] = cap;
        }

        return model;
    }
};

window.CadEngine = CadEngine;
